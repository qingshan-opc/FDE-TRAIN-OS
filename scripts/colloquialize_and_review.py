#!/usr/bin/env python3
"""Apply colloquial narration + generate PPT_AND_NARRATION.md from section YAML or rules."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
NARR_YAML = ROOT / "scripts" / "section_narrations"
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path  # noqa: E402

DAY_PATS = [
    (re.compile(r"\bDay\s*10\b", re.I), "第十天"),
    (re.compile(r"\bDay\s*9\b", re.I), "第九天"),
    (re.compile(r"\bDay\s*8\b", re.I), "第八天"),
    (re.compile(r"\bDay\s*7\b", re.I), "第七天"),
    (re.compile(r"\bDay\s*6\b", re.I), "第六天"),
    (re.compile(r"\bDay\s*5\b", re.I), "第五天"),
    (re.compile(r"\bDay\s*4\b", re.I), "第四天"),
    (re.compile(r"\bDay\s*3\b", re.I), "第三天"),
    (re.compile(r"\bDay\s*2\b", re.I), "第二天"),
    (re.compile(r"\bDay\s*1\b", re.I), "第一天"),
    (re.compile(r"\bDay1\b"), "第一天"),
    (re.compile(r"\bDay2\b"), "第二天"),
    (re.compile(r"\bDay3\b"), "第三天"),
    (re.compile(r"\bDay4\b"), "第四天"),
    (re.compile(r"\bDay5\b"), "第五天"),
    (re.compile(r"\bDay\s*1\s*[–—-]\s*4\b", re.I), "前四天"),
    (re.compile(r"\bDay\s*1\s*[–—-]\s*5\b", re.I), "前五天"),
    (re.compile(r"\bWeek\s*2\b", re.I), "第二周"),
    (re.compile(r"\bWeek\s*1\b", re.I), "第一周"),
]


def replace_day_labels(text: str) -> str:
    for pat, repl in DAY_PATS:
        text = pat.sub(repl, text)
    return text


def colloquialize(text: str, *, first: bool = False) -> str:
    text = replace_day_labels(text.strip())
    text = re.sub(r"\s+", "", text) if False else text  # keep spaces
    text = text.replace("「", "").replace("」", "")
    if first and not text.startswith("同学们"):
        text = "同学们，" + text.lstrip("，")
    if not any(m in text for m in ("同学们", "咱们", "对吧", "嘛", "呢")):
        if text.endswith("。"):
            text = text[:-1] + "，对吧。"
        else:
            text += "，对吧。"
    return text


def parse_slides(html_path: Path) -> list[dict]:
    if not html_path.is_file():
        return []
    html = html_path.read_text(encoding="utf-8")
    slides = []
    for m in re.finditer(
        r'id="(slide-\d+-[^"]+)"[^>]*data-start="([^"]+)"[^>]*data-duration="([^"]+)"',
        html,
    ):
        sid = m.group(1)
        chunk = html[m.start() : m.start() + 2500]
        title_m = re.search(r'<h1[^>]*>([^<]+)</h1>', chunk)
        sub_m = re.search(r'<p class="subtitle"[^>]*>([^<]+)</p>', chunk)
        slides.append({
            "id": sid.replace("slide-", ""),
            "start": m.group(2),
            "duration": m.group(3),
            "title": title_m.group(1).strip() if title_m else sid,
            "subtitle": sub_m.group(1).strip() if sub_m else "",
        })
    return slides


def lesson_koubo(section_dir: Path) -> str:
    md = section_dir / "lesson.md"
    if not md.is_file():
        return ""
    txt = md.read_text(encoding="utf-8")
    m = re.search(r"## 🎬 口播稿[^\n]*\n(.*?)(?=\n## |\Z)", txt, re.S)
    if not m:
        return ""
    lines = []
    for raw in m.group(1).splitlines():
        line = re.sub(r"^>\s*", "", raw.strip()).strip()
        if line:
            lines.append(line)
    return " ".join(lines)


def yaml_key(day: int, sec: str) -> Path:
    return NARR_YAML / f"day{day:02d}_s{sec}.yaml"


def load_section_yaml(day: int, sec: str) -> dict | None:
    p = yaml_key(day, sec)
    if p.is_file():
        return yaml.safe_load(p.read_text(encoding="utf-8"))
    return None


def split_to_segments(koubo: str, slides: list[dict]) -> list[dict]:
    n = max(len(slides), 3)
    parts = [p.strip() for p in re.split(r"(?<=[。！？])", koubo) if p.strip()]
    if not parts:
        return []
    per = max(1, len(parts) // n)
    chunks: list[str] = []
    buf: list[str] = []
    for p in parts:
        buf.append(p)
        if len(buf) >= per and len(chunks) < n - 1:
            chunks.append("".join(buf))
            buf = []
    if buf:
        chunks.append("".join(buf))
    while len(chunks) < n:
        chunks.append("")
    chunks = chunks[:n]

    segments = []
    for i, slide in enumerate(slides[: len(chunks)]):
        sid = slide["id"]
        text = colloquialize(chunks[i], first=(i == 0))
        ppt = [slide["title"]]
        if slide.get("subtitle"):
            ppt.append(slide["subtitle"])
        segments.append({"id": sid, "ppt": ppt, "text": text})
    if not slides:
        slugs = ["open", "main", "detail", "close", "extra"]
        for i, chunk in enumerate(chunks):
            sid = f"{i+1:02d}-{slugs[min(i, len(slugs)-1)]}"
            segments.append({"id": sid, "ppt": [f"段 {i+1}"], "text": colloquialize(chunk, first=(i == 0))})
    return segments


def write_narration(section_dir: Path, segments: list[dict]) -> None:
    narr = section_dir / "video/scripts/narration"
    narr.mkdir(parents=True, exist_ok=True)
    manifest = []
    for seg in segments:
        sid = seg["id"]
        fname = f"{sid}.txt"
        (narr / fname).write_text(seg["text"].strip() + "\n", encoding="utf-8")
        manifest.append({"id": sid, "file": fname})
    (narr / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def section_title(section_dir: Path, day: int, sec: str) -> str:
    md = section_dir / "lesson.md"
    if md.is_file():
        m = re.search(r"^# 第 \d+ 节 · (.+?)（", md.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip()
    return section_dir.name


def day_cn(n: int) -> str:
    names = {5: "五", 6: "六", 7: "七", 8: "八", 9: "九", 10: "十"}
    return f"第{names.get(n, str(n))}天"


def write_ppt_and_narration(section_dir: Path, day: int, sec: str, segments: list[dict], meta: dict) -> None:
    title = meta.get("title") or f"{day_cn(day)} · 第 {int(sec)} 节 · {section_title(section_dir, day, sec)}"
    rel = section_dir.relative_to(ROOT)
    lines = [
        f"# {title}",
        "",
        f"路径：`{rel}/video/`  ",
        f"PPT：`video/index.html`  ",
        f"分词稿：`video/scripts/narration/`",
        "",
        "> 口播待审版 · 确认后再 TTS / 渲染",
        "",
        "---",
        "",
    ]
    for i, seg in enumerate(segments, 1):
        sid = seg["id"]
        label = sid.split("-", 1)[-1] if "-" in sid else sid
        lines.append(f"## {sid.split('-')[0]} · {label}")
        lines.append("")
        lines.append("**PPT**")
        for bullet in seg.get("ppt") or []:
            lines.append(f"- {bullet}")
        lines.append("")
        lines.append("**口播**")
        lines.append(f"> {seg['text'].strip()}")
        lines.append("")
        lines.append(f"文稿：`video/scripts/narration/{sid}.txt`")
        lines.append("")
        lines.append("---")
        lines.append("")
    lines.extend([
        "## 评审清单",
        "",
        "- [ ] 段数与 slide 一致",
        "- [ ] 无 Day N / Week N",
        "- [ ] 每段有口语词 + 例子",
        "- [ ] manifest 语义 slug",
        "",
    ])
    (section_dir / "PPT_AND_NARRATION.md").write_text("\n".join(lines), encoding="utf-8")


def sync_lesson_koubo(section_dir: Path, segments: list[dict]) -> None:
    md = section_dir / "lesson.md"
    if not md.is_file():
        return
    text = md.read_text(encoding="utf-8")
    block = "\n".join(f"> {seg['text'].strip()}" for seg in segments)
    new_block = f"## 🎬 口播稿（约 {max(1, len(segments))} 段 · 待审）\n\n{block}\n"
    if re.search(r"## 🎬 口播稿", text):
        text = re.sub(r"## 🎬 口播稿[^\n]*\n.*?(?=\n## |\Z)", new_block + "\n", text, count=1, flags=re.S)
    else:
        text = text.rstrip() + "\n\n" + new_block
    md.write_text(text, encoding="utf-8")


def process_section(day: int, sec: str, force: bool = False) -> None:
    sd = section_path(day, sec)
    data = load_section_yaml(day, sec)
    slides = parse_slides(sd / "video/index.html")

    if data and data.get("segments"):
        segments = data["segments"]
        for i, seg in enumerate(segments):
            seg["text"] = colloquialize(seg["text"], first=(i == 0))
    else:
        koubo = lesson_koubo(sd)
        if not koubo:
            print(f"skip {sd.name}: no 口播稿")
            return
        koubo = replace_day_labels(koubo)
        segments = split_to_segments(koubo, slides)

    write_narration(sd, segments)
    write_ppt_and_narration(sd, day, sec, segments, data or {})
    sync_lesson_koubo(sd, segments)
    print(f"ok day{day} s{sec} {sd.name} ({len(segments)} segs)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-day", type=int, default=5)
    ap.add_argument("--to-day", type=int, default=10)
    ap.add_argument("--section", default="")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if args.section:
        process_section(args.from_day, args.section.zfill(2), force=args.force)
    else:
        for day in range(args.from_day, args.to_day + 1):
            for sec in section_dirs(day):
                process_section(day, sec, force=args.force)


if __name__ == "__main__":
    main()
