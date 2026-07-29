#!/usr/bin/env python3
"""Bootstrap narration scripts from lesson.md 口播稿 for sections missing manifest."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path  # noqa: E402


def split_koubo(text: str, n: int = 4) -> list[str]:
    text = re.sub(r"\s+", " ", text.strip())
    # split on Chinese sentence boundaries
    parts = [p.strip() for p in re.split(r"(?<=[。！？])", text) if p.strip()]
    if len(parts) <= n:
        return parts
    per = max(1, len(parts) // n)
    chunks = []
    buf: list[str] = []
    for p in parts:
        buf.append(p)
        if len(buf) >= per and len(chunks) < n - 1:
            chunks.append("".join(buf))
            buf = []
    if buf:
        chunks.append("".join(buf))
    return chunks[:n]


def bootstrap(section_dir: Path, force: bool = False) -> None:
    md = section_dir / "lesson.md"
    if not md.is_file():
        return
    txt = md.read_text(encoding="utf-8")
    m = re.search(r"## 🎬 口播稿[^\n]*\n(.*?)(?=\n## |\Z)", txt, re.S)
    if not m:
        return
    lines = []
    for raw in m.group(1).splitlines():
        line = re.sub(r"^>\s*", "", raw.strip()).strip()
        if line:
            lines.append(line)
    if not lines:
        return

    narr = section_dir / "video" / "scripts" / "narration"
    if (narr / "manifest.json").is_file() and not force:
        return
    narr.mkdir(parents=True, exist_ok=True)
    # 按 > 段落分段，保留原始语义分段（不再用 split_koubo 重新拆分）
    chunks = lines
    slugs = ["open", "core", "detail", "method", "extra", "close"]
    manifest = []
    for i, chunk in enumerate(chunks):
        sid = f"{i+1:02d}-{slugs[min(i, len(slugs)-1)]}"
        fname = f"{sid}.txt"
        (narr / fname).write_text(chunk + "\n", encoding="utf-8")
        manifest.append({"id": sid, "file": fname})
    (narr / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pkg = section_dir / "video" / "package.json"
    if not pkg.exists():
        gold = BC / "day-05" / "section-01-worldview-plain" / "video" / "package.json"
        if gold.is_file():
            pkg.write_text(gold.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"bootstrapped {narr} ({len(manifest)} segments)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--section", default="")
    ap.add_argument("--force", action="store_true", help="overwrite existing manifest")
    args = ap.parse_args()
    if args.section:
        bootstrap(section_path(args.day, args.section), force=args.force)
    else:
        for sec in section_dirs(args.day):
            bootstrap(section_path(args.day, sec), force=args.force)


if __name__ == "__main__":
    main()
