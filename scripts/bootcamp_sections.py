"""Bootcamp section directory mapping from README chapter table."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

BC = Path(__file__).resolve().parents[1] / "class" / "bootcamp"


def section_dirs(day: int) -> dict[str, str]:
    readme = BC / f"day-{day:02d}" / "README.md"
    dirs: list[str] = []
    if readme.is_file():
        for m in re.finditer(r"\| \d+ \| `(section-[^`/]+)/`", readme.read_text(encoding="utf-8")):
            name = m.group(1)
            if (BC / f"day-{day:02d}" / name).is_dir():
                dirs.append(name)
    if not dirs:
        yaml_path = BC / f"day-{day:02d}" / "day.yaml"
        if yaml_path.is_file():
            data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
            n = len(data.get("capsule_extra") or {})
            candidates = sorted(
                d.name
                for d in (BC / f"day-{day:02d}").iterdir()
                if d.is_dir() and d.name.startswith("section-")
            )
            # prefer dirs with new-style video/narration manifest
            scored = []
            for c in candidates:
                manifest = BC / f"day-{day:02d}" / c / "video/scripts/narration/manifest.json"
                scored.append((0 if manifest.is_file() else 1, c))
            scored.sort()
            dirs = [c for _, c in scored[:n]]
    return {f"{i:02d}": d for i, d in enumerate(dirs, start=1)}


def section_path(day: int, sec: str) -> Path:
    sec = sec.zfill(2)
    mapping = section_dirs(day)
    if sec not in mapping:
        raise KeyError(f"day {day} has no section {sec}; have {list(mapping)}")
    return BC / f"day-{day:02d}" / mapping[sec]
