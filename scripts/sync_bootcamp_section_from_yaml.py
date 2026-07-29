#!/usr/bin/env python3
"""Sync narration + professional PPT from scripts/section_narrations/dayNN_sSS.yaml."""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
DIAG_SRC = ROOT / "class/assets/diagrams"
YAML_DIR = ROOT / "scripts/section_narrations"

sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path  # noqa: E402

_align_spec = importlib.util.spec_from_file_location(
    "align_day06", ROOT / "scripts/align_day06_section_ppt.py"
)
align = importlib.util.module_from_spec(_align_spec)
_align_spec.loader.exec_module(align)  # type: ignore[union-attr]

DAY_CN = {6: "第六天", 7: "第七天", 8: "第八天", 9: "第九天", 10: "第十天"}


def yaml_path(day: int, sec: str) -> Path:
    return YAML_DIR / f"day{day:02d}_s{int(sec):02d}.yaml"


def copy_diagram(svg: str, section_dir: Path) -> None:
    dest = section_dir / "video/assets/diagrams"
    dest.mkdir(parents=True, exist_ok=True)
    src = DIAG_SRC / svg
    if src.is_file():
        shutil.copy2(src, dest / svg)


def oral_cards(text: str, n: int = 3) -> list[tuple[str, str, str]]:
    parts = [p.strip() for p in re.split(r"(?<=[。！？])", text.strip()) if len(p.strip()) >= 8]
    cards: list[tuple[str, str, str]] = []
    for i, p in enumerate(parts[:n]):
        p = p.replace("同学们，", "").strip()
        if len(p) > 28:
            cards.append((f"0{i + 1}", p[:16] + "…", p[16:40]))
        else:
            cards.append((f"0{i + 1}", p, ""))
    return cards


def parse_ppt(ppt: list[str], oral: str, sid: str) -> dict:
    diagram = None
    headline = None
    subtitle = None
    subtitle2 = None
    cards: list[tuple[str, str, str]] = []
    tags: list[tuple[str, bool]] = []
    flow: list[tuple[str, str]] = []

    for line in ppt:
        line = line.strip()
        if not line:
            continue
        if line.startswith("眉题："):
            topic = line.replace("眉题：", "").strip()
            if " · " in topic:
                _, rest = topic.split(" · ", 1)
                headline = headline or rest
            continue
        if line.startswith("讲解图："):
            svg = line.split("：", 1)[1].strip()
            diagram = ("讲解图 · " + svg.replace(".svg", ""), svg)
            continue
        if line.startswith("下一节") or line.startswith("预告"):
            subtitle2 = line.replace("下一节 → ", "下一节：")
            continue
        if "→" in line:
            for i, st in enumerate(re.split(r"\s*→\s*", line.replace("流程：", "")), 1):
                if st.strip():
                    flow.append((f"0{i}", st.strip()))
            continue
        if " · " in line:
            parts = [p.strip() for p in line.split(" · ") if p.strip()]
            if len(parts) >= 3:
                cards.append((parts[0], parts[1], parts[2]))
            elif len(parts) == 2:
                cards.append(("要点", parts[0], parts[1]))
            else:
                for j, p in enumerate(parts):
                    tags.append((p, j == 0))
            continue
        if line.startswith("双列：") or line.startswith("三卡："):
            continue
        if not headline:
            headline = line
        elif not subtitle:
            subtitle = line
        else:
            cards.append(("要点", line, ""))

    slug = sid.split("-", 1)[-1] if "-" in sid else sid
    if not headline:
        headline = slug.replace("-", " ")
    if not cards and oral:
        cards = oral_cards(oral)
    if slug.endswith("close") or slug in ("close", "graduate", "takeaway"):
        if cards and not tags:
            tags = [(c[1], i == 0) for i, c in enumerate(cards[:4])]
            cards = []

    out: dict = {"headline": headline}
    if subtitle:
        out["subtitle"] = subtitle
    if cards:
        out["cards"] = cards[:4]
    if tags:
        out["tags"] = tags[:6]
    if flow:
        out["flow"] = flow[:5]
    if diagram:
        out["diagram"] = diagram
    if subtitle2:
        out["subtitle2"] = subtitle2
    if sid.endswith("-close") or slug in ("close", "graduate", "takeaway"):
        out["h_size"] = 56
    return out


def sync_narration(section_dir: Path, data: dict) -> list[dict]:
    narr = section_dir / "video/scripts/narration"
    narr.mkdir(parents=True, exist_ok=True)
    manifest = []
    for seg in data["segments"]:
        sid = seg["id"]
        slug = sid.split("-", 1)[1]
        fname = f"{sid.split('-')[0]}-{slug}.txt"
        (narr / fname).write_text(seg.get("text", "").strip() + "\n", encoding="utf-8")
        manifest.append({"id": sid, "file": fname})
        for line in seg.get("ppt", []):
            if str(line).startswith("讲解图："):
                copy_diagram(str(line).split("：", 1)[1].strip(), section_dir)
    (narr / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def patch_day07_html(section_dir: Path, old_manifest: list[dict], new_manifest: list[dict]) -> None:
    html_path = section_dir / "video/index.html"
    if not html_path.is_file():
        return
    html = html_path.read_text(encoding="utf-8")
    for old, new in zip(old_manifest, new_manifest):
        if old["id"] != new["id"]:
            html = html.replace(f'slide-{old["id"]}', f'slide-{new["id"]}')
    html = html.replace("Day 07", "第七天").replace("Week 2", "第二周")
    html = html.replace("WEEK 1", "第一周").replace("WEEK 2", "第二周")
    html_path.write_text(html, encoding="utf-8")


def build_section_config(day: int, sec: str, section_dir: Path, data: dict) -> dict:
    title = data.get("title", section_dir.name)
    brand = f"{DAY_CN.get(day, f'第{day}天')} · 第 {int(sec)} 节"
    slides = []
    slides_meta = []
    for seg in data["segments"]:
        sid = seg["id"]
        num = sid.split("-")[0]
        slug = sid.split("-", 1)[1]
        label = slug.upper().replace("-", " ")
        parsed = parse_ppt(seg.get("ppt", []), seg.get("text", "").strip(), sid)
        slides.append({"id": sid, "num": num, "label": label[:24], **parsed})
        slides_meta.append({"id": sid, "label": label[:24], "ppt": seg.get("ppt", [])})
    short = title.split("·")[-1].strip() if "·" in title else title
    return {
        "dir": section_dir.name,
        "title": short,
        "md_title": title,
        "brand": brand,
        "diagrams": [],
        "slides_meta": slides_meta,
        "slides": slides,
    }


def ensure_assets(section_dir: Path) -> None:
    video = section_dir / "video"
    gold = BC / "day-05/section-01-worldview-plain/video"
    fonts = video / "assets/fonts"
    if not fonts.exists() and (gold / "assets/fonts").is_dir():
        shutil.copytree(gold / "assets/fonts", fonts)
    pkg = video / "package.json"
    if not pkg.exists() and (gold / "package.json").is_file():
        shutil.copy2(gold / "package.json", pkg)


def sync_section(day: int, sec: str, regen_html: bool) -> None:
    ypath = yaml_path(day, sec)
    if not ypath.is_file():
        print(f"SKIP no yaml day{day} s{sec}")
        return
    section_dir = section_path(day, sec)
    data = yaml.safe_load(ypath.read_text(encoding="utf-8"))
    ensure_assets(section_dir)
    old_manifest: list[dict] = []
    mf = section_dir / "video/scripts/narration/manifest.json"
    if mf.is_file():
        old_manifest = json.loads(mf.read_text(encoding="utf-8"))
    new_manifest = sync_narration(section_dir, data)
    if day == 7 and not regen_html:
        patch_day07_html(section_dir, old_manifest, new_manifest)
    elif regen_html:
        cfg = build_section_config(day, sec, section_dir, data)
        (section_dir / "video/index.html").write_text(
            align.build_html(cfg, section_dir), encoding="utf-8"
        )
    cfg = build_section_config(day, sec, section_dir, data)
    (section_dir / "PPT_AND_NARRATION.md").write_text(
        align.build_ppt_md(cfg, section_dir), encoding="utf-8"
    )
    print(f"OK day{day:02d} s{sec} · {len(new_manifest)} segments")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-day", type=int, default=6)
    ap.add_argument("--to-day", type=int, default=10)
    ap.add_argument("--regen-html", action="store_true")
    ap.add_argument("--align-day06", action="store_true")
    args = ap.parse_args()
    if args.align_day06 or (args.from_day <= 6 <= args.to_day):
        align.main()
    for day in range(args.from_day, args.to_day + 1):
        for sec in section_dirs(day):
            if day == 6 and sec == "01":
                continue
            sync_section(day, sec, regen_html=args.regen_html or day >= 8)


if __name__ == "__main__":
    main()
