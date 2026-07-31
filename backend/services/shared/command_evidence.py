"""Command / acceptance evidence helpers for Week1 AI team指挥与验收."""

from __future__ import annotations

import re
from typing import Any

WEEK1_COMMAND_DAYS = 5
CAPABILITY_TAG = "capability:ai_team_command"


def command_log_path(day: int) -> str:
    return f"docs/D{day}_command_log.md"


def build_lab_capability_tags(*, day: int, passed: bool, evidence_kind: str) -> list[str]:
    tags = [f"eval:{evidence_kind}", "pass" if passed else "fail", f"day:{day}"]
    if passed:
        tags.extend([CAPABILITY_TAG, f"command:day:{day}"])
    return tags


def parse_command_log_stats(text: str) -> dict[str, Any]:
    approved = len(re.findall(r"\bAPPROVED\b|已批准", text, flags=re.IGNORECASE))
    rejected = len(re.findall(r"\bREJECTED\b|未批准", text, flags=re.IGNORECASE))
    roles = re.findall(r"岗位[:：]\s*([^\s|｜]+)", text)
    unique_roles = list(dict.fromkeys(roles))
    return {"approved": approved, "rejected": rejected, "roles": unique_roles}


def command_acceptance_score(tags: set[str] | list[str], *, target_days: int = WEEK1_COMMAND_DAYS) -> int:
    tag_set = set(tags)
    passed_days = sum(1 for d in range(1, target_days + 1) if f"command:day:{d}" in tag_set)
    if target_days <= 0:
        return 0
    return max(0, min(100, round(100 * passed_days / target_days)))


def try_read_command_stats_from_workspace(ws_path: str | Any, day: int | None = None) -> dict[str, Any] | None:
    """Best-effort parse of command log from a workspace directory."""
    from pathlib import Path

    root = Path(ws_path)
    candidates: list[Path] = []
    if day is not None:
        candidates.append(root / command_log_path(day))
    else:
        for n in range(1, 16):
            candidates.append(root / command_log_path(n))
    for path in candidates:
        if path.is_file():
            try:
                stats = parse_command_log_stats(path.read_text(encoding="utf-8"))
                stats["path"] = str(path.relative_to(root))
                return stats
            except OSError:
                return None
    return None
