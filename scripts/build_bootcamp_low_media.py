#!/usr/bin/env python3
"""Low-quality bootcamp section videos from lesson.md 口播稿 (macOS say + title cards).

Outputs to class/bootcamp/day-NN/section-*/video/renders/{object_key_basename}.mp4
and updates day.yaml duration_sec when --patch-yaml is set.

Usage:
  python3 scripts/build_bootcamp_low_media.py --day 1
  python3 scripts/build_bootcamp_low_media.py --day 1 --section 01
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

from bootcamp_sections import section_dirs  # noqa: E402

FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
VOICE = "Tingting"
SAY_RATE = 210
WIDTH, HEIGHT = 854, 480
BG = (11, 15, 20)
ACCENT = (56, 214, 200)
FG = (245, 247, 250)
MUTED = (150, 165, 175)
MEDIA_PREFIX = "documents/shared/course-media"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def section_slug(section_name: str) -> str:
    m = re.match(r"section-\d+-(.+)", section_name)
    return m.group(1) if m else section_name


def extract_oral(lesson_path: Path) -> list[str]:
    text = lesson_path.read_text(encoding="utf-8")
    m = re.search(r"## 🎬 口播稿[^\n]*\n+(.*?)(?=\n## |\Z)", text, re.S)
    if not m:
        raise ValueError(f"no 口播稿 in {lesson_path}")
    body = m.group(1).strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if not paras:
        raise ValueError(f"empty 口播稿 in {lesson_path}")
    return paras


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        if font.getlength(trial) > max_width and current:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def render_card(out_png: Path, header: str, body: str, frame_no: int, total: int) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)
    title_font = ImageFont.truetype(FONT_BOLD, 28)
    body_font = ImageFont.truetype(FONT_REGULAR, 22)
    small = ImageFont.truetype(FONT_REGULAR, 16)
    draw.text((40, 36), header, font=title_font, fill=ACCENT)
    draw.text((40, 78), f"片段 {frame_no}/{total}", font=small, fill=MUTED)
    y = 120
    for line in wrap_text(body, body_font, WIDTH - 80)[:12]:
        draw.text((40, y), line, font=body_font, fill=FG)
        y += 32
    draw.text((40, HEIGHT - 40), "FDE 训练营 · 低清预览版", font=small, fill=MUTED)
    img.save(out_png)


def media_keys(day: int, cap_index: int, slug: str) -> tuple[str, str]:
    base = f"{MEDIA_PREFIX}/day{day:02d}-c{cap_index}-{slug}"
    return f"{base}.mp4", f"{base}-poster.jpg"


def build_section(day: int, sec: str, *, voice: str, rate: int) -> dict:
    mapping = section_dirs(day)
    section_name = mapping[sec.zfill(2)]
    section_dir = ROOT / "class" / "bootcamp" / f"day-{day:02d}" / section_name
    lesson = section_dir / "lesson.md"
    cap_index = int(sec)
    slug = section_slug(section_name)
    paras = extract_oral(lesson)
    video_key, poster_key = media_keys(day, cap_index, slug)
    basename = video_key.rsplit("/", 1)[-1]
    poster_base = poster_key.rsplit("/", 1)[-1]
    renders = section_dir / "video" / "renders"
    renders.mkdir(parents=True, exist_ok=True)
    mp4_out = renders / basename
    poster_out = renders / poster_base
    header = f"Day {day} · 第 {cap_index} 节"

    with tempfile.TemporaryDirectory(prefix=f"d{day}s{sec}-") as tmp_s:
        tmp = Path(tmp_s)
        audio_segments: list[Path] = []
        video_segments: list[Path] = []
        for i, para in enumerate(paras, start=1):
            aiff = tmp / f"line{i:02d}.aiff"
            run(["say", "-v", voice, "-r", str(rate), "-o", str(aiff), para])
            wav = tmp / f"line{i:02d}.wav"
            run(["ffmpeg", "-y", "-i", str(aiff), str(wav)])
            dur = ffprobe_duration(wav)
            audio_segments.append(wav)
            png = tmp / f"frame{i:02d}.png"
            render_card(png, header, para[:120] + ("…" if len(para) > 120 else ""), i, len(paras))
            seg = tmp / f"seg{i:02d}.mp4"
            run([
                "ffmpeg", "-y", "-loop", "1", "-i", str(png),
                "-t", f"{dur:.3f}", "-r", "15",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "32",
                "-pix_fmt", "yuv420p", "-vf", f"scale={WIDTH}:{HEIGHT}",
                str(seg),
            ])
            video_segments.append(seg)

        audio_list = tmp / "audio.txt"
        audio_list.write_text("".join(f"file '{p}'\n" for p in audio_segments))
        full_wav = tmp / "full.wav"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(audio_list), "-c", "copy", str(full_wav)])

        video_list = tmp / "video.txt"
        video_list.write_text("".join(f"file '{p}'\n" for p in video_segments))
        silent = tmp / "silent.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(silent)])

        run([
            "ffmpeg", "-y", "-i", str(silent), "-i", str(full_wav),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "64k", "-shortest",
            str(mp4_out),
        ])
        run(["ffmpeg", "-y", "-ss", "0.5", "-i", str(mp4_out), "-frames:v", "1", "-q:v", "8", str(poster_out)])

    duration = ffprobe_duration(mp4_out)
    manifest = {
        "day": day,
        "section": sec,
        "slug": slug,
        "video_key": video_key,
        "poster_key": poster_key,
        "video_path": str(mp4_out.relative_to(ROOT)),
        "duration_sec": round(duration, 1),
        "paragraphs": len(paras),
    }
    (renders / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK {mp4_out.relative_to(ROOT)} ({duration:.1f}s, {len(paras)} segments)")
    return manifest


def patch_day_yaml(day: int, manifests: list[dict]) -> None:
    yaml_path = ROOT / "class" / "bootcamp" / f"day-{day:02d}" / "day.yaml"
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    extra = data.setdefault("capsule_extra", {})
    for m in manifests:
        cap = f"c{int(m['section'])}"
        extra.setdefault(cap, {})
        mem = extra[cap].get("memory_sentence") or ""
        title = mem[:32] if mem else f"第 {int(m['section'])} 节"
        extra[cap]["media"] = [{
            "kind": "video",
            "title": f"口播课件 · {title[:24]}",
            "object_key": m["video_key"],
            "poster_key": m["poster_key"],
            "duration_sec": int(round(m["duration_sec"])),
        }]
    yaml_path.write_text(yaml.dump(data, allow_unicode=True, sort_keys=False, width=120), encoding="utf-8")
    print(f"patched {yaml_path.relative_to(ROOT)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--section", default="", help="01..05; default all sections")
    ap.add_argument("--voice", default=VOICE)
    ap.add_argument("--rate", type=int, default=SAY_RATE)
    ap.add_argument("--patch-yaml", action="store_true", default=True)
    ap.add_argument("--no-patch-yaml", action="store_false", dest="patch_yaml")
    args = ap.parse_args()

    secs = [args.section.zfill(2)] if args.section else sorted(section_dirs(args.day))
    manifests = [build_section(args.day, sec, voice=args.voice, rate=args.rate) for sec in secs]
    if args.patch_yaml:
        patch_day_yaml(args.day, manifests)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
