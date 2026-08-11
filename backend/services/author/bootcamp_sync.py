"""Build day packages from class/bootcamp — shared by CLI and author sync API."""

from __future__ import annotations

import sys

import re
from pathlib import Path
from typing import Any, Literal

import yaml

from services.shared.config import CURRICULUM_VERSION_TAG

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402
BC = _ROOT / "class" / "bootcamp"

CAMP_VERSION = CURRICULUM_VERSION_TAG
LINGZHI_PROJECT = "role-week"

MergeMode = Literal["full", "media_fields"]


def bootcamp_root() -> Path:
    return BC


def list_available_days() -> list[int]:
    days: list[int] = []
    if not BC.is_dir():
        return days
    for p in sorted(BC.glob("day-*/day.yaml")):
        try:
            day = int(p.parent.name.split("-", 1)[1])
        except (IndexError, ValueError):
            continue
        days.append(day)
    return sorted(set(days))


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def _readme(day: int) -> dict[str, Any]:
    rm = _read(BC / f"day-{day:02d}" / "README.md")
    title_m = re.search(r"^# Day \d+ ·\s*(.+)$", rm, re.M)
    if not title_m:
        raise ValueError(f"day-{day:02d}: README title not found")
    title = title_m.group(1).strip()
    total_m = re.search(r"总时长 (\d+)′", rm)
    total = int(total_m.group(1)) if total_m else 0
    caps: list[dict[str, Any]] = []
    for m in re.finditer(
        r"^\| (\d+) \| `([^`]+)/` \| (.+?) \| (\d+)′ \| (.+?) \| (.+?) \|$", rm, re.M
    ):
        caps.append(
            {
                "no": int(m.group(1)),
                "dir": m.group(2),
                "title": m.group(3).strip(),
                "minutes": int(m.group(4)),
                "form": m.group(5).strip(),
                "outcome": m.group(6).strip(),
            }
        )
    gm = re.search(r"## 今日验收（(.+?)）\n\n?(.*?)(?=\n## |\Z)", rm, re.S)
    gate_name = gm.group(1).strip() if gm else f"GATE {day}"
    checklist: list[str] = []
    if gm:
        for line in gm.group(2).splitlines():
            line = line.strip()
            mm = re.match(r"^- (?:\[ \] )?(.+)$", line)
            if mm:
                checklist.append(mm.group(1).strip().rstrip("；。"))
    return {"title": title, "total": total, "caps": caps, "gate": gate_name, "checklist": checklist}


def _koubo(day: int, sdir: str) -> str:
    txt = _read(BC / f"day-{day:02d}" / sdir / "lesson.md")
    m = re.search(r"## 🎬 口播稿[^\n]*\n(.*?)(?=\n## |\Z)", txt, re.S)
    if m:
        lines = []
        for raw in m.group(1).splitlines():
            line = re.sub(r"^>\s*", "", raw.strip()).strip()
            lines.append(line)
        content = "\n".join(lines).strip()
        content = re.sub(r"\n{3,}", "\n\n", content)
        if content:
            return content
    m = re.search(r"## 教学目标\n(.*?)(?=\n## |\Z)", txt, re.S)
    if m:
        pts = [
            re.sub(r"^[-*]\s*", "", l).strip()
            for l in m.group(1).splitlines()
            if l.strip().startswith(("-", "*"))
        ]
        return "；".join(pts)
    return "（见本节 lesson.md）"


_CHECKLIST_HEADERS = (
    "学员验收清单",
    "手工检查清单",
    "完成标志",
    "过关标准",
    "周末交付清单",
)

_INCLUDE_RE = re.compile(r"\{\{include:([^}]+)\}\}")
_MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def _checklist_items(txt: str) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for header in _CHECKLIST_HEADERS:
        m = re.search(rf"## {re.escape(header)}\n(.*?)(?=\n## |\Z)", txt, re.S)
        if not m:
            continue
        for raw in m.group(1).splitlines():
            line = raw.strip()
            mm = re.match(r"^[-*]\s*(?:\[[ xX]\]\s*)?(.+)$", line)
            if not mm:
                continue
            item = mm.group(1).strip().rstrip("；。")
            if item and item not in seen:
                seen.add(item)
                items.append(item)
    return items


def _expand_includes(text: str, *, base: Path | None = None) -> str:
    """Expand ``{{include:relative/or/repo/path.md}}`` from repo root or ``base``."""

    def repl(match: re.Match[str]) -> str:
        rel = match.group(1).strip()
        candidates = [_ROOT / rel]
        if base is not None:
            candidates.insert(0, (base / rel).resolve())
        for cand in candidates:
            if cand.is_file():
                return _read(cand).strip()
        return match.group(0)

    return _INCLUDE_RE.sub(repl, text)


def _prompt_from_teaching_links(practice_path: Path, txt: str) -> str:
    """Resolve markdown links to teaching pack prompt files into copyable text."""
    chunks: list[str] = []
    seen: set[Path] = set()
    for match in _MD_LINK_RE.finditer(txt):
        rel = match.group(1).strip()
        if "://" in rel or not rel.endswith(".md"):
            continue
        if "/prompts/" not in rel.replace("\\", "/") and not rel.startswith("prompts/"):
            continue
        target = (practice_path.parent / rel).resolve()
        if not target.is_file():
            target = (_ROOT / rel.lstrip("./")).resolve()
        if not target.is_file() or target in seen:
            continue
        seen.add(target)
        chunks.append(_read(target).strip())
    return "\n\n---\n\n".join(chunks)


def _practice(day: int, sdir: str) -> str:
    p = BC / f"day-{day:02d}" / sdir / "practice.md"
    if not p.exists():
        return "见本节 practice.md"
    txt = _read(p)
    parts: list[str] = []
    task_m = re.search(r"## 实操任务[^\n]*\n(.*?)(?=\n## |\Z)", txt, re.S)
    if task_m:
        # Keep a short plain-text brief (drop nested headings / links noise lightly).
        brief = re.sub(r"\n{3,}", "\n\n", task_m.group(1).strip())
        if brief:
            parts.append(brief[:600])
    pts = _checklist_items(txt)
    if pts:
        parts.append("完成标志：\n" + "\n".join(f"[ ] {point}" for point in pts))
    if parts:
        return "\n\n".join(parts)
    return "按本节 practice.md 完成任务并达到完成标志。"


def _local_prep(day: int, sdir: str) -> dict[str, Any] | None:
    """Project the hands-on block from practice.md into the learner UI.

    Week 1 practice files deliberately keep the learner instruction, copyable
    TRAE prompt and acceptance checklist together.  Turning that source into a
    local_prep payload makes the course follow the same four-step flow on every
    lesson: explain → confirm → practise in TRAE → submit evidence.

    Week 2+ may point at teaching-pack prompt files via markdown links under
    「一键粘贴提示词」; those files are inlined so the learner UI still gets a
    one-click copyable ``codex_prompt``.
    """

    p = BC / f"day-{day:02d}" / sdir / "practice.md"
    if not p.exists():
        return None
    txt = _read(p)

    prompt_m = re.search(
        r"## 一键粘贴提示词[^\n]*\n.*?```(?:text)?\s*\n(.*?)\n```",
        txt,
        re.S,
    )
    correction_m = re.search(
        r"## 纠偏句式\n.*?```(?:text)?\s*\n(.*?)\n```",
        txt,
        re.S,
    )

    prompt = prompt_m.group(1).strip() if prompt_m else ""
    if not prompt:
        # Also accept ### 一键粘贴… / 「教学包全文」 subsections with bare links.
        link_region = txt
        region_m = re.search(
            r"##[^\n]*一键粘贴提示词[^\n]*\n(.*?)(?=\n## |\Z)",
            txt,
            re.S,
        )
        if region_m:
            link_region = region_m.group(0)
        prompt = _prompt_from_teaching_links(p, link_region)

    checklist = _checklist_items(txt)

    if not prompt and not checklist:
        return None

    out: dict[str, Any] = {
        "codex_prompt": prompt,
        "checklist": checklist,
    }
    if correction_m:
        out["suggested_questions"] = [correction_m.group(1).strip()]
    return out


def _expand_local_prep_includes(local_prep: dict[str, Any]) -> dict[str, Any]:
    prompt = local_prep.get("codex_prompt")
    if isinstance(prompt, str) and "{{include:" in prompt:
        local_prep = {**local_prep, "codex_prompt": _expand_includes(prompt)}
    return local_prep


def _quiz(raw_questions: list) -> dict[str, Any]:
    return {
        "pass_rate": 0.67,
        "questions": [
            {"q": q, "options": opts, "answer": ans, "explain": ex}
            for q, opts, ans, ex in raw_questions
        ],
    }


def build_day_package(day: int) -> dict[str, Any]:
    day_dir = BC / f"day-{day:02d}"
    if not (day_dir / "day.yaml").is_file():
        raise ValueError(f"day-{day:02d}: day.yaml not found")
    meta = _readme(day)
    data = yaml.safe_load(_read(day_dir / "day.yaml"))
    if int(data.get("day", day)) != day:
        raise ValueError(f"day.yaml day mismatch: {data.get('day')} != {day}")

    capsules: list[dict[str, Any]] = []
    for cap in meta["caps"]:
        cid = f"c{cap['no']}"
        cref = f"class/bootcamp/day-{day:02d}/{cap['dir']}/lesson.md"
        capsule: dict[str, Any] = {
            "id": cid,
            "title": cap["title"],
            "minutes": cap["minutes"],
            "form": cap["form"],
            "content_ref": cref,
            "content": _koubo(day, cap["dir"]),
            "practice": _practice(day, cap["dir"]),
        }
        extra = (data.get("capsule_extra") or {}).get(cid) or {}
        for key in ("resource_ids", "tools", "quiz", "local_prep", "lab", "media", "knowledge_cards", "glossary_terms", "memory_sentence"):
            if key in extra:
                capsule[key] = extra[key]
        knowledge = (data.get("knowledge_content") or {}).get(cid) or {}
        for key in ("knowledge_cards", "memory_sentence", "quiz"):
            if knowledge.get(key):
                capsule[key] = knowledge[key]
        if not capsule.get("local_prep"):
            local_prep = _local_prep(day, cap["dir"])
            if local_prep:
                capsule["local_prep"] = local_prep
        if isinstance(capsule.get("local_prep"), dict):
            capsule["local_prep"] = _expand_local_prep_includes(capsule["local_prep"])
        capsules.append(capsule)

    week = 1 if day <= 6 else 2 if day <= 11 else 3
    delivery_mode = str(data.get("delivery_mode") or "full")
    if delivery_mode == "video_quiz":
        # 第三周沟通特训：仅视频+答题，不强制实操/练习提交
        for capsule in capsules:
            capsule.pop("practice", None)
            capsule.pop("local_prep", None)
    lab = data.get("lab")
    inherited: list[str] = []
    if lab and lab.get("runner") != "sim":
        for prev in range(1, day):
            prev_path = BC / f"day-{prev:02d}" / "day.yaml"
            if not prev_path.is_file():
                continue
            prev_data = yaml.safe_load(_read(prev_path))
            prev_lab = prev_data.get("lab") or {}
            for f in prev_lab.get("primary_files") or []:
                if f not in inherited:
                    inherited.append(f)

    lab_out: dict[str, Any] | None = None
    if lab and delivery_mode != "video_quiz":
        if lab.get("runner") == "sim":
            lab_out = {
                "runner": "sim",
                "sim_kind": lab["sim_kind"],
                "ui": lab.get("ui") or {},
                "seed": lab.get("seed") or {},
                "coach": lab.get("coach") or {"help_mode": "explain", "skill_id": "fde-coach", "max_help_level": 2},
                "adapter_version": "1.0",
                "rubric": lab["rubric"],
            }
            if lab.get("task_brief"):
                lab_out["task_brief"] = lab["task_brief"]
            if lab.get("quick_commands"):
                lab_out["quick_commands"] = lab["quick_commands"]
        else:
            lab_out = {
                "runner": "agent",
                "workspace_mode": "cumulative",
                "primary_files": lab["primary_files"],
                "inherited_files": inherited,
                "coach": {"help_mode": "debug", "skill_id": "fde-coach", "max_help_level": 3},
                "adapter_version": "1.0",
                "agent": {"prompt_template": lab["prompt"]},
                "rubric": lab["rubric"],
            }

    nodes = [
        {"type": "learn", "title": f"今日课节（{len(meta['caps'])} 节 · {meta['total']}′）"},
        {"type": "quiz", "title": f"Day{day} 概念验收"},
    ]
    if delivery_mode == "video_quiz":
        # 第三周沟通特训：仅视频 + 答题，无 Lab/项目节点
        nodes.append({"type": "review", "title": f"今日复盘与 {meta['gate']}"})
    else:
        if lab_out:
            nodes.append({"type": "lab", "title": data.get("nodes_lab", "Lab")})
        nodes.append({"type": "project", "title": data.get("nodes_project") or f"企业任务：{meta['title']}"})
        nodes.append({"type": "review", "title": f"交付自检与 {meta['gate']}"})

    pkg: dict[str, Any] = {
        "camp_version": CAMP_VERSION,
        "day": day,
        "title": meta["title"],
        "week": week,
        "project": data["project"],
        "project_brief": data["project_brief"],
        "review_checklist": meta["checklist"],
        "resources": data.get("resources") or [],
        "learn": {
            "lingzhi_tags": [f"camp:{CAMP_VERSION}", f"day:{day}", f"project:{LINGZHI_PROJECT}"],
            "estimated_minutes": meta["total"],
            "require_capsules": True,
            "capsules": capsules,
        },
        "quiz": _quiz(data.get("quiz") or []),
        "nodes": nodes,
    }
    if lab_out:
        pkg["lab"] = lab_out
    return pkg


_MEDIA_FIELDS = ("content", "practice", "media", "knowledge_cards", "glossary_terms", "resource_ids", "tools", "local_prep", "memory_sentence")


def merge_day_package(
    existing: dict[str, Any] | None,
    bootcamp: dict[str, Any],
    merge_mode: MergeMode,
) -> dict[str, Any]:
    if merge_mode == "full" or not existing:
        return bootcamp

    merged = dict(existing)
    for key in ("title", "week", "project", "project_brief", "review_checklist", "resources"):
        if bootcamp.get(key) is not None:
            merged[key] = bootcamp[key]

    exist_caps = {
        str(c.get("id")): dict(c)
        for c in ((existing.get("learn") or {}).get("capsules") or [])
        if isinstance(c, dict) and c.get("id")
    }
    boot_caps = (bootcamp.get("learn") or {}).get("capsules") or []
    out_caps: list[dict[str, Any]] = []
    seen: set[str] = set()
    for bc in boot_caps:
        if not isinstance(bc, dict):
            continue
        cid = str(bc.get("id") or "")
        if not cid:
            continue
        seen.add(cid)
        if cid in exist_caps:
            cap = dict(exist_caps[cid])
            for field in _MEDIA_FIELDS:
                if bc.get(field) is not None:
                    cap[field] = bc[field]
            if bc.get("title"):
                cap["title"] = bc["title"]
            if bc.get("minutes") is not None:
                cap["minutes"] = bc["minutes"]
            out_caps.append(cap)
        else:
            out_caps.append(dict(bc))
    for cid, cap in exist_caps.items():
        if cid not in seen:
            out_caps.append(cap)
    out_caps.sort(key=lambda c: int(re.sub(r"\D", "", str(c.get("id") or "0")) or 0))

    learn = dict(existing.get("learn") or {})
    learn["capsules"] = out_caps
    if bootcamp.get("learn", {}).get("estimated_minutes"):
        learn["estimated_minutes"] = bootcamp["learn"]["estimated_minutes"]
    merged["learn"] = learn
    merged["day"] = bootcamp.get("day", merged.get("day"))
    return merged


def _capsule_summary(capsule: dict[str, Any]) -> dict[str, Any]:
    media = capsule.get("media") or []
    cards = capsule.get("knowledge_cards") or []
    return {
        "id": capsule.get("id"),
        "title": capsule.get("title"),
        "content_len": len(str(capsule.get("content") or "")),
        "media_count": len(media) if isinstance(media, list) else 0,
        "knowledge_cards_count": len(cards) if isinstance(cards, list) else 0,
        "media_keys": [m.get("object_key") for m in media if isinstance(m, dict) and m.get("object_key")],
    }


def preview_day_sync(
    existing: dict[str, Any] | None,
    day: int,
    merge_mode: MergeMode,
) -> dict[str, Any]:
    boot = build_day_package(day)
    merged = merge_day_package(existing, boot, merge_mode)
    changes: list[str] = []
    if not existing:
        changes.append("新建日包")
    elif merge_mode == "full":
        if existing.get("title") != merged.get("title"):
            changes.append(f"标题: {existing.get('title')} → {merged.get('title')}")
    else:
        old_caps = {str(c.get("id")): c for c in ((existing.get("learn") or {}).get("capsules") or []) if isinstance(c, dict)}
        for cap in (merged.get("learn") or {}).get("capsules") or []:
            if not isinstance(cap, dict):
                continue
            cid = str(cap.get("id") or "")
            old = old_caps.get(cid)
            if not old:
                changes.append(f"{cid}: 新增课节")
                continue
            for field in _MEDIA_FIELDS:
                if cap.get(field) != old.get(field):
                    changes.append(f"{cid}: 更新 {field}")
    return {
        "day": day,
        "title": merged.get("title"),
        "capsule_count": len((merged.get("learn") or {}).get("capsules") or []),
        "capsules": [_capsule_summary(c) for c in ((merged.get("learn") or {}).get("capsules") or []) if isinstance(c, dict)],
        "changes": changes,
        "package_json": merged,
    }


def get_bootcamp_capsule_media(day: int, capsule_id: str) -> list[dict[str, Any]]:
    """Return media[] from day.yaml capsule_extra for one bootcamp section."""
    pkg = build_day_package(day)
    cid = str(capsule_id).strip()
    for cap in (pkg.get("learn") or {}).get("capsules") or []:
        if isinstance(cap, dict) and str(cap.get("id")) == cid:
            media = cap.get("media") or []
            return [dict(m) for m in media if isinstance(m, dict)]
    raise ValueError(f"day-{day:02d}: capsule {cid} not found in bootcamp")


def sync_bootcamp_days(
    existing_by_day: dict[int, dict[str, Any] | None],
    days: list[int],
    merge_mode: MergeMode,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (previews, errors). previews include package_json when not dry-run."""
    previews: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for day in days:
        try:
            preview = preview_day_sync(existing_by_day.get(day), day, merge_mode)
            previews.append(preview)
        except Exception as exc:
            errors.append({"day": day, "error": str(exc)})
    return previews, errors
