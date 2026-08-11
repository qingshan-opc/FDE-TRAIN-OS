"""Day-task orchestrator — YAML schema, node gates, quiz."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import yaml
from fastapi import APIRouter, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.shared import (  # noqa: E402
    CONTRACTS_DIR,
    CONTRACTS_UPLOAD_DIR,
    db_cursor,
    init_schema,
    now_iso,
)
from services.shared.config import DEFAULT_CAMP_ID  # noqa: E402
from services.shared.middleware import (  # noqa: E402
    require_camp_access,
    resolve_camp_id,
    session_learner_id,
)
from services.shared.rubric_registry import enrich_rubric_list  # noqa: E402

NodeKind = Literal["learn", "quiz", "lab", "project", "review", "unlock"]
NodeStatus = Literal["locked", "available", "in_progress", "passed", "failed"]

router = APIRouter(tags=["orchestrator"])
app = FastAPI(title="FDE Orchestrator", version="0.3.0")
init_schema()

REQUIRED_NODE_ORDER = ["learn", "quiz", "lab", "project", "review", "unlock"]
# Learner UI no longer surfaces daily quiz/project/review; only learn (+ lab)
# gates cross-day unlock and in-day progression.
DAY_GATE_KINDS = frozenset({"learn", "lab"})
# These kinds remain in packages for data/API compat but must not block learn→lab.
NON_BLOCKING_KINDS = frozenset({"quiz", "project", "review", "unlock"})


class NodeState(BaseModel):
    id: str
    kind: NodeKind
    title: str = ""
    status: NodeStatus
    refs: dict[str, Any] = Field(default_factory=dict)


class DayPackageView(BaseModel):
    camp_version: str
    camp_id: str
    day: int
    title: str
    project: str | None = None
    project_brief: str | None = None
    review_checklist: list[str] = Field(default_factory=list)
    learn: dict[str, Any] = Field(default_factory=dict)
    lab: dict[str, Any] = Field(default_factory=dict)
    quiz: dict[str, Any] = Field(default_factory=dict)
    nodes: list[NodeState]
    source: str | None = None
    week: int | None = None
    # Learner-facing supplementary tools/materials declared at the package's
    # top level (e.g. `agent-lab-guide`, `cursor-optional`) — surfaced by the
    # learner UI alongside (not instead of) `/camps/{camp}/days/{day}/resources`.
    resources: list[dict[str, Any]] = Field(default_factory=list)


def _contract_dirs() -> list[Path]:
    return [CONTRACTS_UPLOAD_DIR, CONTRACTS_DIR]


def _capsule_ids(capsules: list[Any]) -> list[str]:
    """Mirror the frontend's `c.id || \`c${i+1}\`` fallback so backend gate
    checks (capsule_progress / practice_responses lookups) key on the same
    capsule id the client used to mark it opened/submitted."""
    ids: list[str] = []
    for i, c in enumerate(capsules):
        cid = c.get("id") if isinstance(c, dict) else None
        ids.append(str(cid) if cid else f"c{i+1}")
    return ids


def _capsule_practice_required(capsule: Any) -> bool:
    """`practice` accepts a legacy plain string (implicitly required — that's
    the only form the field has ever had, so treat any non-empty string as a
    required text prompt) or an object `{prompt, input_type?, required?}`."""
    if not isinstance(capsule, dict):
        return False
    practice = capsule.get("practice")
    if isinstance(practice, str):
        return bool(practice.strip())
    if isinstance(practice, dict):
        return bool(practice.get("required"))
    return False


def _normalize_learn(data: dict[str, Any]) -> dict[str, Any]:
    """Ensure learn.steps exists; derive from capsules titles when missing."""
    learn = dict(data.get("learn") or {})
    capsules = learn.get("capsules") or []
    if capsules and not learn.get("steps"):
        learn["steps"] = [
            (c.get("title") or c.get("id") or f"胶囊{i+1}") if isinstance(c, dict) else str(c)
            for i, c in enumerate(capsules)
        ]
    if "require_capsules" not in learn:
        learn["require_capsules"] = bool(capsules)
    data["learn"] = learn
    return learn


def _load_day_yaml(day: int) -> tuple[dict[str, Any], Path]:
    """Prefer day-NN-curriculum.yaml across dirs, then other packs; skip empty-node stubs."""
    curriculum_name = f"day-{day:02d}-curriculum.yaml"
    # 1) explicit curriculum in examples, then uploads
    for base in (CONTRACTS_DIR, CONTRACTS_UPLOAD_DIR):
        if not base.exists():
            continue
        curriculum = base / curriculum_name
        if curriculum.exists():
            data = yaml.safe_load(curriculum.read_text(encoding="utf-8")) or {}
            if data.get("nodes"):
                _validate_day(data)
                return data, curriculum
    # 2) other day-NN-*.yaml (sim/agent/uploads), skip empty nodes
    candidates: list[Path] = []
    for base in _contract_dirs():
        if not base.exists():
            continue
        candidates.extend(sorted(base.glob(f"day-{day:02d}-*.yaml")))

    def rank(p: Path) -> tuple[int, str]:
        name = p.name
        if name.endswith("-curriculum.yaml"):
            return (0, name)
        if name.endswith("-sim.yaml"):
            return (1, name)
        if name.endswith("-agent.yaml"):
            return (2, name)
        return (3, name)

    for p in sorted(candidates, key=rank):
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        if not (data.get("nodes") or []):
            continue
        _validate_day(data)
        return data, p
    raise FileNotFoundError(f"no contract for day {day}")


def _validate_day(data: dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise HTTPException(400, "invalid day yaml")
    nodes = data.get("nodes") or []
    if not nodes:
        raise HTTPException(400, "day yaml missing nodes")
    _normalize_learn(data)
    lab = data.get("lab") or {}
    runner = lab.get("runner")
    if not runner:
        if lab.get("sim_kind"):
            lab["runner"] = "sim"
        elif lab.get("agent"):
            lab["runner"] = "agent"
        data["lab"] = lab
    runner = (data.get("lab") or {}).get("runner")
    if runner == "sim" and not (data.get("lab") or {}).get("sim_kind"):
        raise HTTPException(400, "lab.runner=sim requires sim_kind")
    if runner == "agent" and not (data.get("lab") or {}).get("agent"):
        raise HTTPException(400, "lab.runner=agent requires agent block")


def _load_day_package(
    day: int, camp_id: str | None = None, learner_id: str | None = None
) -> tuple[dict[str, Any], str]:
    """Dual-read a day package.

    Domain v2: prefer the day package stored on the learner/camp's active
    course_version (``day_packages.package_json``). If that is missing or
    unusable, fall back to the legacy YAML contract files. The DB path is a pure
    enhancement — any error resolving it degrades gracefully to YAML.

    Returns ``(data, source_label)``.
    """
    if camp_id:
        try:
            from services.application import course_runtime

            res = course_runtime.get_day_data(camp_id, day, learner_id=learner_id)
            if res:
                data, source = res
                _validate_day(data)
                return data, source
        except Exception:
            # Any failure (resolution, validation, DB) -> fall back to YAML.
            pass
    data, path = _load_day_yaml(day)
    return data, path.name


def _get_status(learner_id: str, camp_id: str, day: int, node_id: str) -> str | None:
    from services.db import session_scope
    from services.repositories import ProgressRepository

    with session_scope() as session:
        return ProgressRepository(session).get_status(learner_id, camp_id, day, node_id)


def _fetch_progress_map(learner_id: str, camp_id: str) -> dict[tuple[int, str], str]:
    from services.db import session_scope
    from services.repositories import ProgressRepository

    with session_scope() as session:
        return ProgressRepository(session).progress_map(learner_id, camp_id)


def _status_from_map(progress_map: dict[tuple[int, str], str], day: int, node_id: str) -> str | None:
    return progress_map.get((day, node_id))


def _kind_from_node_id(node_id: str) -> str:
    # ids look like d3-learn / d12-quiz
    parts = node_id.rsplit("-", 1)
    return parts[-1] if len(parts) == 2 else node_id


def _compute_statuses_from_map(
    day: int,
    node_ids: list[str],
    progress_map: dict[tuple[int, str], str],
    kinds: list[str] | None = None,
) -> list[str]:
    """Gate on learn/lab only. quiz/project/review stay non-blocking so the
    simplified learner syllabus (capsules + weekly quiz) can progress."""
    out: list[str] = []
    unlocked_next = True
    for i, nid in enumerate(node_ids):
        kind = (kinds[i] if kinds and i < len(kinds) else None) or _kind_from_node_id(nid)
        stored = _status_from_map(progress_map, day, nid)
        if stored == "passed":
            out.append("passed")
            if kind in DAY_GATE_KINDS:
                unlocked_next = True
            continue
        if kind in NON_BLOCKING_KINDS:
            # Available once prior gate nodes are done; never blocks later gates.
            out.append(stored or ("available" if unlocked_next else "locked"))
            continue
        if unlocked_next:
            out.append(stored or "available")
            unlocked_next = False
        else:
            out.append("locked")
    return out


def _set_status(learner_id: str, camp_id: str, day: int, node_id: str, status: str) -> None:
    from services.db import session_scope
    from services.repositories import ProgressRepository

    with session_scope() as session:
        ProgressRepository(session).set_status(learner_id, camp_id, day, node_id, status)


def _compute_statuses(
    learner_id: str,
    camp_id: str,
    day: int,
    node_ids: list[str],
    kinds: list[str] | None = None,
) -> list[str]:
    """Gate: only first incomplete gate-node is available; passed stay passed."""
    progress_map = _fetch_progress_map(learner_id, camp_id)
    return _compute_statuses_from_map(day, node_ids, progress_map, kinds)


def _gate_node_ids(day: int, kinds: list[str]) -> list[str]:
    ids = [f"d{day}-{k}" for k in kinds]
    gated = [nid for nid, k in zip(ids, kinds) if k in DAY_GATE_KINDS]
    if gated:
        return gated
    # Fallback: learn-only when package has neither lab nor explicit gates.
    return [nid for nid, k in zip(ids, kinds) if k == "learn"] or ids[:1]


def _day_unlocked_from_meta(
    day: int,
    day_meta: dict[int, tuple[list[str], list[str]]],
    progress_map: dict[tuple[int, str], str],
) -> bool:
    if day <= 1:
        return True
    prev_day = day - 1
    meta = day_meta.get(prev_day)
    if not meta:
        return True
    kinds, _titles = meta
    if not kinds:
        return True
    check_ids = _gate_node_ids(prev_day, kinds)
    return all(_status_from_map(progress_map, prev_day, nid) == "passed" for nid in check_ids)


def _day_unlocked(learner_id: str, camp_id: str, day: int) -> bool:
    """Cross-day gate: Day 1 always open; Day N needs Day N-1 learn (+ lab if any)."""
    if day <= 1:
        return True
    prev_day = day - 1
    try:
        data, _ = _load_day_package(prev_day, camp_id, learner_id)
    except FileNotFoundError:
        return True
    kinds = [(n.get("type") or n.get("kind")) for n in (data.get("nodes") or [])]
    if not kinds:
        return True
    check_ids = _gate_node_ids(prev_day, kinds)
    return all(_get_status(learner_id, camp_id, prev_day, nid) == "passed" for nid in check_ids)


def _check_learn_gate(learner_id: str, camp_id: str, day: int, data: dict[str, Any]) -> None:
    """Server-side enforcement for completing a `learn` node (M7).

    The frontend already blocks the "完成学习" button until every capsule is
    opened and every required practice is submitted, but that's only a UX
    nicety — without this check a learner could call
    `POST /api/v1/nodes/{id}/complete` directly and skip both. Mirrors the
    frontend's gating exactly so the two never disagree.
    """
    learn = _normalize_learn(data)
    if not learn.get("require_capsules"):
        return
    capsules = learn.get("capsules") or []
    if not capsules:
        return
    capsule_ids = _capsule_ids(capsules)
    with db_cursor() as cur:
        cur.execute(
            "SELECT capsule_id FROM capsule_progress WHERE learner_id=? AND camp_id=? AND day=?",
            (learner_id, camp_id, day),
        )
        opened = {dict(r)["capsule_id"] for r in cur.fetchall()}
    missing_open = [cid for cid in capsule_ids if cid not in opened]
    if missing_open:
        raise HTTPException(409, f"请先点开全部知识胶囊：还差 {len(missing_open)} 个")

    required_ids = [cid for c, cid in zip(capsules, capsule_ids) if _capsule_practice_required(c)]
    if not required_ids:
        return
    with db_cursor() as cur:
        cur.execute(
            "SELECT capsule_id FROM practice_responses WHERE learner_id=? AND camp_id=? AND day=? AND status='submitted'",
            (learner_id, camp_id, day),
        )
        submitted = {dict(r)["capsule_id"] for r in cur.fetchall()}
    missing_practice = [cid for cid in required_ids if cid not in submitted]
    if missing_practice:
        raise HTTPException(409, f"请先提交练习：还差 {len(missing_practice)} 个胶囊练习")


@router.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "orchestrator", "contracts": str(CONTRACTS_DIR)}


class DayNodeSummary(BaseModel):
    id: str
    title: str = ""
    kind: str
    status: str


class CampDaySummary(BaseModel):
    day: int
    title: str
    project: str | None = None
    source: str
    runner: str | None = None
    passed: int | None = None
    total: int | None = None
    locked: bool = False
    nodes: list[DayNodeSummary] | None = None
    capsules: list[dict[str, Any]] | None = None


def _capsule_summaries(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Expose the Week/Day lesson menu without unlocking lesson content."""

    items: list[dict[str, Any]] = []
    for index, capsule in enumerate(((data.get("learn") or {}).get("capsules") or []), start=1):
        if not isinstance(capsule, dict):
            continue
        items.append(
            {
                "id": str(capsule.get("id") or f"c{index}"),
                "title": str(capsule.get("title") or f"第 {index} 节"),
                "minutes": capsule.get("minutes"),
            }
        )
    return items


def _pack_rank(name: str) -> int:
    if name.endswith("-curriculum.yaml"):
        return 0
    if name.endswith("-sim.yaml"):
        return 1
    if name.endswith("-agent.yaml"):
        return 2
    return 3


def _normalize_camp_id(camp_id: str) -> str:
    """Map legacy aliases like ``default`` onto the configured camp."""
    cid = (camp_id or "").strip()
    if not cid or cid in {"default", "demo"}:
        return DEFAULT_CAMP_ID
    return cid


@router.get("/api/v1/camps/{camp_id}/days")
def list_days(camp_id: str, request: Request) -> dict[str, Any]:
    """List day packages — YAML discovery, then prefer DB (MinIO-backed persistence)."""
    camp_id = _normalize_camp_id(camp_id)
    user = getattr(request.state, "user", None)
    if user:
        require_camp_access(request, camp_id)

    staff_preview = bool(user and getattr(user, "role", None) in ("author", "admin"))

    found: dict[int, CampDaySummary] = {}
    node_counts: dict[int, int] = {}
    day_meta: dict[int, tuple[list[str], list[str]]] = {}
    for base in _contract_dirs():
        if not base.exists():
            continue
        for p in sorted(base.glob("day-*.yaml"), key=lambda x: (_pack_rank(x.name), x.name)):
            try:
                data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
                day = int(data.get("day") or 0)
                if day < 1:
                    continue
                prev = found.get(day)
                if prev and _pack_rank(prev.source) < _pack_rank(p.name):
                    continue
                lab = data.get("lab") or {}
                runner = lab.get("runner") or (
                    "sim" if lab.get("sim_kind") else "agent" if lab.get("agent") else None
                )
                nodes = data.get("nodes") or []
                kinds = [(n.get("type") or n.get("kind")) for n in nodes]
                titles = [str(n.get("title") or "") for n in nodes]
                day_meta[day] = (kinds, titles)
                node_counts[day] = len(nodes) or 6
                found[day] = CampDaySummary(
                    day=day,
                    title=str(data.get("title") or f"Day {day}"),
                    project=data.get("project"),
                    source=p.name,
                    runner=runner,
                    total=node_counts[day],
                    passed=0,
                    capsules=_capsule_summaries(data),
                )
            except Exception:
                continue

    # Always overlay DB packages (even anonymous) so bootstrap-stale YAML cannot
    # hide the persisted curriculum learners actually take.
    lid = user.id if user else None
    progress_map = _fetch_progress_map(lid, camp_id) if user else {}
    if found:
        for day, summary in found.items():
            kinds: list[str] = []
            titles: list[str] = []
            try:
                data, source_name = _load_day_package(day, camp_id, lid)
                summary.title = str(data.get("title") or summary.title)
                if data.get("project") is not None:
                    summary.project = data.get("project")
                summary.source = source_name
                summary.capsules = _capsule_summaries(data)
                for n in data.get("nodes") or []:
                    kinds.append(n.get("type") or n.get("kind"))
                    titles.append(str(n.get("title") or ""))
            except Exception:
                kinds, titles = day_meta.get(day, ([], []))
            day_meta[day] = (kinds, titles)
            ids = [f"d{day}-{k}" for k in kinds] if kinds else []
            total = len(ids) or summary.total or 6
            passed = 0
            node_summaries: list[DayNodeSummary] | None = None
            if user and ids:
                statuses = _compute_statuses_from_map(day, ids, progress_map, kinds)
                if staff_preview:
                    # Authors/admins preview every node as available.
                    statuses = ["available" if s == "locked" else s for s in statuses]
                passed = sum(1 for s in statuses if s == "passed")
                node_summaries = [
                    DayNodeSummary(id=nid, title=titles[i], kind=kinds[i], status=statuses[i])
                    for i, nid in enumerate(ids)
                    if kinds[i] != "unlock"
                ]
            elif user:
                passed = sum(
                    1
                    for (d, _nid), status in progress_map.items()
                    if d == day and status == "passed"
                )
            summary.passed = passed
            summary.total = total
            summary.nodes = node_summaries
            if user:
                summary.locked = False if staff_preview else (not _day_unlocked_from_meta(day, day_meta, progress_map))
            else:
                summary.locked = False

    items = [found[k] for k in sorted(found)]
    # Week1: Day1–6；Week2: Day7–11；Week3 企业沟通特训：Day12–17（视频+答题）。
    weeks: dict[str, list[int]] = {"1": [1, 2, 3, 4, 5, 6], "2": [7, 8, 9, 10, 11]}
    week3 = [d for d in sorted(found) if d >= 12]
    if week3:
        weeks["3"] = week3
    return {"camp_id": camp_id, "days": items, "count": len(items), "weeks": weeks}


@router.get("/api/v1/camps/{camp_id}/days/{day}", response_model=DayPackageView)
def get_day(camp_id: str, day: int, request: Request) -> DayPackageView:
    camp_id = _normalize_camp_id(camp_id)
    user = require_camp_access(request, camp_id)
    lid = session_learner_id(request)
    staff_preview = user.role in ("author", "admin")
    if not staff_preview and not _day_unlocked(lid, camp_id, day):
        raise HTTPException(403, "请先完成前一日课程")
    try:
        data, source_name = _load_day_package(day, camp_id, lid)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    learn = _normalize_learn(data)
    lab = data.get("lab") or {}
    if lab.get("rubric"):
        # Explainable eval (M3): enrich once so both `day.lab.rubric` and the
        # per-node `refs.rubric` below carry the same Chinese fields.
        lab = {**lab, "rubric": enrich_rubric_list(lab.get("rubric"))}
    runner = lab.get("runner") or ("sim" if lab.get("sim_kind") else "agent" if lab.get("agent") else "none")
    quiz = data.get("quiz") or {}
    project_brief = data.get("project_brief")
    review_checklist = data.get("review_checklist") or []

    kinds = []
    titles = []
    for n in data.get("nodes") or []:
        kinds.append(n.get("type") or n.get("kind"))
        titles.append(n.get("title") or "")
    ids = [f"d{day}-{k}" for k in kinds]
    statuses = _compute_statuses(lid, camp_id, day, ids, kinds)

    nodes_out: list[NodeState] = []
    for i, kind in enumerate(kinds):
        refs: dict[str, Any] = {}
        if kind == "learn":
            refs = {
                "tags": learn.get("lingzhi_tags") or [],
                "steps": learn.get("steps") or [],
                "capsules": learn.get("capsules") or [],
                "require_capsules": bool(learn.get("require_capsules")),
                "estimated_minutes": learn.get("estimated_minutes"),
            }
        if kind == "quiz":
            refs = {
                "questions": quiz.get("questions") or [],
                "pass_rate": quiz.get("pass_rate", 0.8),
            }
        if kind == "lab":
            refs = {
                "runner": runner,
                "sim_kind": lab.get("sim_kind"),
                "agent": lab.get("agent"),
                "rubric": lab.get("rubric"),
                "seed": lab.get("seed"),
                "ui": lab.get("ui"),
                "coach": lab.get("coach"),
                "workspace_mode": lab.get("workspace_mode"),
                "primary_files": lab.get("primary_files") or [],
                "inherited_files": lab.get("inherited_files") or [],
            }
        if kind == "project":
            refs = {"brief": project_brief or "", "project": data.get("project")}
        if kind == "review":
            refs = {"checklist": review_checklist}
        nodes_out.append(
            NodeState(id=ids[i], kind=kind, title=titles[i], status=statuses[i], refs=refs)  # type: ignore[arg-type]
        )

    # Hide the `unlock` node from the learner-facing package: it's an
    # internal bookkeeping node (auto-completed by `complete_node` once every
    # other node has passed) and should never appear as something to "do".
    visible_nodes = [n for n in nodes_out if n.kind != "unlock"]

    return DayPackageView(
        camp_version=str(data.get("camp_version") or "v0.3"),
        camp_id=camp_id,
        day=int(data.get("day") or day),
        title=str(data.get("title") or f"Day {day}"),
        project=data.get("project"),
        project_brief=project_brief,
        review_checklist=list(review_checklist),
        learn=learn,
        lab=lab,
        quiz=quiz,
        nodes=visible_nodes,
        source=source_name,
        week=int(data.get("week") or (1 if day <= 6 else 2)),
        resources=list(data.get("resources") or []),
    )


class CompleteBody(BaseModel):
    camp_id: str | None = None
    day: int = 1
    evidence_id: str | None = None
    # accepted for backward-compat client payloads — always ignored, session wins
    learner_id: str | None = None


@router.post("/api/v1/nodes/{node_id}/complete")
def complete_node(node_id: str, body: CompleteBody, request: Request) -> dict[str, Any]:
    lid = session_learner_id(request)
    camp_id = resolve_camp_id(request, body.camp_id)
    day = body.day
    user = getattr(request.state, "user", None)
    staff_preview = bool(user and getattr(user, "role", None) in ("author", "admin"))
    if not staff_preview and not _day_unlocked(lid, camp_id, day):
        raise HTTPException(403, "请先完成前一日课程")
    try:
        data, _ = _load_day_package(day, camp_id, lid)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    kinds = [(n.get("type") or n.get("kind")) for n in (data.get("nodes") or [])]
    ids = [f"d{day}-{k}" for k in kinds]
    if node_id not in ids:
        raise HTTPException(400, "unknown node for day")
    idx = ids.index(node_id)
    statuses = _compute_statuses(lid, camp_id, day, ids, kinds)
    if not staff_preview and statuses[idx] == "locked":
        raise HTTPException(409, "节点未解锁，请先完成前置节点")
    if kinds[idx] == "learn":
        _check_learn_gate(lid, camp_id, day, data)
    _set_status(lid, camp_id, day, node_id, "passed")
    # Prefer unlocking the next gate node (lab) over hidden quiz/project/review.
    next_id = None
    for j in range(idx + 1, len(ids)):
        if kinds[j] in DAY_GATE_KINDS or kinds[j] not in NON_BLOCKING_KINDS:
            next_id = ids[j]
            break
    if next_id:
        _set_status(lid, camp_id, day, next_id, "available")

    unlocked: str | None = next_id
    unlock_id = ids[kinds.index("unlock")] if "unlock" in kinds else None
    gate_ids = _gate_node_ids(day, kinds)
    gates_passed = bool(gate_ids) and all(
        _get_status(lid, camp_id, day, nid) == "passed" for nid in gate_ids
    )
    if unlock_id and unlock_id != node_id and gates_passed:
        if _get_status(lid, camp_id, day, unlock_id) != "passed":
            _set_status(lid, camp_id, day, unlock_id, "passed")
        if unlocked == unlock_id:
            unlocked = None

    day_complete = gates_passed
    next_day = day + 1 if day_complete else None

    return {
        "node_id": node_id,
        "status": "passed",
        "unlocked": unlocked,
        "day_complete": day_complete,
        "next_day": next_day,
        "evidence_id": body.evidence_id,
    }


class QuizSubmit(BaseModel):
    camp_id: str | None = None
    day: int = 1
    node_id: str
    answers: list[int] = Field(default_factory=list)
    # accepted for backward-compat client payloads — always ignored, session wins
    learner_id: str | None = None


@router.post("/api/v1/quiz/submit")
def submit_quiz(body: QuizSubmit, request: Request) -> dict[str, Any]:
    lid = session_learner_id(request)
    camp_id = resolve_camp_id(request, body.camp_id)
    data, _ = _load_day_package(body.day, camp_id, lid)
    quiz = data.get("quiz") or {}
    questions = quiz.get("questions") or []
    if not questions:
        # default quiz from day1
        questions = [
            {"q": "前端主要负责？", "options": ["界面与交互", "数据持久化", "容器编排"], "answer": 0},
            {"q": "数据库更像餐厅的？", "options": ["服务员", "仓库", "菜单"], "answer": 1},
            {"q": "FDE 核心价值？", "options": ["背语法", "落地交付", "只调模型"], "answer": 1},
        ]
    correct = 0
    for i, q in enumerate(questions):
        ans = body.answers[i] if i < len(body.answers) else -1
        if ans == q.get("answer"):
            correct += 1
    score = correct / max(len(questions), 1)
    pass_rate = float(quiz.get("pass_rate") or 0.8)
    passed = score >= pass_rate
    aid = str(uuid4())
    with db_cursor() as cur:
        cur.execute(
            "INSERT INTO quiz_attempts (id, learner_id, camp_id, day, node_id, score, pass, answers_json, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (aid, lid, camp_id, body.day, body.node_id, score, 1 if passed else 0, str(body.answers), now_iso()),
        )
    if passed:
        _set_status(lid, camp_id, body.day, body.node_id, "passed")
        # unlock next
        kinds = [(n.get("type") or n.get("kind")) for n in (data.get("nodes") or [])]
        ids = [f"d{body.day}-{k}" for k in kinds]
        if body.node_id in ids:
            idx = ids.index(body.node_id)
            if idx + 1 < len(ids):
                _set_status(lid, camp_id, body.day, ids[idx + 1], "available")
    return {
        "attempt_id": aid,
        "score": score,
        "pass": passed,
        "pass_rate": pass_rate,
        "correct": correct,
        "total": len(questions),
        "details": [
            {
                "index": i,
                "correct": (body.answers[i] if i < len(body.answers) else -1) == q.get("answer"),
                "answer": q.get("answer"),
                "explain": q.get("explain") or "",
            }
            for i, q in enumerate(questions)
        ],
    }


@router.get("/api/v1/contracts")
def list_contracts() -> dict[str, Any]:
    items = []
    for base in _contract_dirs():
        if not base.exists():
            continue
        for p in sorted(base.glob("day-*.yaml")):
            items.append({"name": p.name, "dir": str(base), "uploaded": base == CONTRACTS_UPLOAD_DIR})
    return {"items": items}


app.include_router(router)
