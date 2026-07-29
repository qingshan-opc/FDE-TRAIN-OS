#!/usr/bin/env python3
"""Generate narration YAML + txt for bootcamp days 7–10 from lesson.md 口播稿."""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
YAML_DIR = ROOT / "scripts" / "section_narrations"
BC = ROOT / "class" / "bootcamp"

sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path  # noqa: E402

DAY_PATS = [
    (re.compile(r"\bDay\s*10\b", re.I), "第十天"),
    (re.compile(r"\bDay\s*9\b", re.I), "第九天"),
    (re.compile(r"\bDay\s*8\b", re.I), "第八天"),
    (re.compile(r"\bDay\s*7\b", re.I), "第七天"),
    (re.compile(r"\bWeek\s*2\b", re.I), "第二周"),
    (re.compile(r"\bWeek\s*1\b", re.I), "第一周"),
    (re.compile(r"\bDay\s*5\b", re.I), "第五天"),
    (re.compile(r"\bDay\s*9\b", re.I), "第九天"),
]

SKIP_SECTIONS = {(7, "01")}  # S01 已精修，保留现有 yaml


def normalize_labels(text: str) -> str:
    for pat, repl in DAY_PATS:
        text = pat.sub(repl, text)
    text = text.replace("**", "")
    return text.strip()


def extract_oral_paragraphs(lesson_path: Path) -> list[str]:
    if not lesson_path.is_file():
        return []
    text = lesson_path.read_text(encoding="utf-8")
    idx = text.find("## 🎬 口播稿")
    if idx < 0:
        return []
    rest = text[idx:]
    end = rest.find("\n## ")
    if end > 0:
        rest = rest[:end]
    paras: list[str] = []
    for line in rest.splitlines():
        line = line.strip()
        if line.startswith(">"):
            p = line[1:].strip()
            if p and not p.startswith("详见"):
                paras.append(normalize_labels(p))
    return paras


def apply_open(text: str) -> str:
    text = re.sub(r"^同学们好，我是你们的老师404[。，]?", "", text)
    text = re.sub(r"^同学们[，,]?", "", text)
    return f"同学们好，我是你们的老师404。{text.strip()}"


def apply_close(text: str) -> str:
    text = re.sub(r"^收个尾[：:]?\s*", "", text)
    text = re.sub(r"^同学们，本节先到这里[。，]?", "", text)
    text = re.sub(r"[，,]?对吧[。]?$", "。", text)
    text = re.sub(r"[，,]?嘛[。]?$", "。", text)
    text = text.rstrip("。") + "。" if text and not text.endswith("。") else text
    if not text.startswith("同学们，本节先到这里"):
        text = f"同学们，本节先到这里。{text}"
    return text.strip()


def fit_paragraphs(paras: list[str], n: int) -> list[str]:
    if not paras:
        return [""] * n
    if len(paras) == n:
        return paras
    if len(paras) > n:
        head = paras[: n - 1]
        tail = " ".join(paras[n - 1 :])
        return head + [tail]
    out = paras[:]
    while len(out) < n:
        out.append(out[-1])
    return out


def generate_section(day: int, sec: str, *, dry_run: bool = False) -> tuple[int, int]:
    if (day, sec) in SKIP_SECTIONS:
        print(f"SKIP day{day:02d} s{sec} (preserved)")
        return 0, 0

    ypath = YAML_DIR / f"day{day:02d}_s{sec}.yaml"
    if not ypath.is_file():
        print(f"WARN no yaml {ypath.name}")
        return 0, 0

    data = yaml.safe_load(ypath.read_text(encoding="utf-8"))
    segs = data.get("segments") or []
    lesson = section_path(day, sec) / "lesson.md"
    paras = extract_oral_paragraphs(lesson)
    if not paras:
        print(f"WARN no 口播稿 in {lesson}")
        return 0, 0

    fitted = fit_paragraphs(paras, len(segs))
    if len(paras) != len(segs):
        print(f"NOTE day{day:02d} s{sec}: lesson {len(paras)} paras → {len(segs)} segments")

    for i, seg in enumerate(segs):
        text = fitted[i]
        if i == 0:
            text = apply_open(text)
        elif i == len(segs) - 1:
            text = apply_close(text)
        seg["text"] = text.strip() + "\n"

    if dry_run:
        print(f"DRY day{day:02d} s{sec} · {len(segs)} segs")
        return len(segs), sum(len(s["text"]) for s in segs)

    ypath.write_text(yaml.dump(data, allow_unicode=True, sort_keys=False, width=120), encoding="utf-8")
    chars = sum(len(s["text"]) for s in segs)
    print(f"OK day{day:02d} s{sec} · {len(segs)} segs · {chars} chars")
    return len(segs), chars


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-day", type=int, default=7)
    ap.add_argument("--to-day", type=int, default=10)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-sync", action="store_true")
    args = ap.parse_args()

    total_segs = 0
    total_chars = 0
    for day in range(args.from_day, args.to_day + 1):
        for sec in section_dirs(day):
            n, c = generate_section(day, sec, dry_run=args.dry_run)
            total_segs += n
            total_chars += c

    print(f"TOTAL {total_segs} segments · {total_chars} chars")

    if not args.dry_run and not args.no_sync:
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/sync_bootcamp_section_from_yaml.py"),
                "--from-day",
                str(args.from_day),
                "--to-day",
                str(args.to_day),
            ],
            check=True,
            cwd=ROOT,
        )


if __name__ == "__main__":
    main()
