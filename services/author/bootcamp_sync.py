"""Build day packages from class/bootcamp — shared by CLI and author sync API."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Literal

import yaml

from services.shared.config import CURRICULUM_VERSION_TAG

_ROOT = Path(__file__).resolve().parents[2]
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


def _practice(day: int, sdir: str) -> str:
    p = BC / f"day-{day:02d}" / sdir / "practice.md"
    if not p.exists():
        return "见本节 practice.md"
    txt = _read(p)
    m = re.search(r"## 完成标志\n(.*?)(?=\n## |\Z)", txt, re.S)
    if m:
        pts = [
            re.sub(r"^[-*]\s*", "", l).strip().rstrip("；。")
            for l in m.group(1).splitlines()
            if l.strip().startswith(("-", "*"))
        ]
        if pts:
            return "完成标志：" + "；".join(pts) + "。"
    return "按本节 practice.md 完成任务并达到完成标志。"


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
        for key in ("resource_ids", "tools", "quiz", "local_prep", "lab", "media", "knowledge_cards", "glossary_terms"):
            if extra.get(key):
                capsule[key] = extra[key]
        capsules.append(capsule)

    week = 1 if day <= 5 else 2
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
    if lab:
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


_MEDIA_FIELDS = ("content", "practice", "media", "knowledge_cards", "glossary_terms", "resource_ids", "local_prep")


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
