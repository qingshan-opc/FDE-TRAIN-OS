#!/usr/bin/env python3
"""Generate Day1 course-media MP3/MP4/poster assets from SCRIPT.md + STORYBOARD.md.

Pipeline (pragmatic, no HyperFrames CLI dependency):
  1. Parse SCRIPT.md -> voice name + N narration lines (one per storyboard frame).
  2. Parse STORYBOARD.md -> per-frame short scene caption + duration hint.
  3. For each line: macOS `say` -> aiff, measure exact duration with ffprobe.
  4. Render a 1920x1080 title-card PNG per frame (Pillow, CJK font) and stretch it
     to a silent video segment of exactly that line's audio duration (ffmpeg).
  5. Concat the silent video segments and concat the audio segments separately,
     then mux them into the final explainer.mp4. Also emit a standalone mp3.
  6. Extract a poster JPG from the final video.
  7. Write renders/manifest.json with per-frame timestamps + a transcript string
     in the `mm:ss text` shape used by day-01-curriculum.yaml.

Usage:
  python3 scripts/build_course_media.py fde-day01-c1 [fde-day01-c3 ...]
  python3 scripts/build_course_media.py --all
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
VIDEOS_DIR = ROOT / "videos"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
WIDTH, HEIGHT = 1920, 1080
BG = (11, 15, 20)
ACCENT = (56, 214, 200)
FG = (245, 247, 250)
MUTED = (150, 165, 175)

CAPSULE_LABELS = {
    "c1": "FDE Day1 · C1 FDE是谁",
    "c3": "FDE Day1 · C3 Prompt准星",
    "c4": "FDE Day1 · C4 浏览器主路径",
    "c6": "FDE Day1 · C6 今日交付规格",
}


@dataclass
class Line:
    number: int
    label: str
    text: str  # spoken text, single line, for TTS


@dataclass
class Frame:
    number: int
    scene: str  # short caption for title card


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


def parse_script(path: Path) -> tuple[str, list[Line]]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"\*\*Voice:\*\*\s*(\S+)", text)
    voice = m.group(1) if m else "Tingting"
    lines: list[Line] = []
    blocks = re.split(r"^## Line (\d+) — (.+?)\s*\(Frame \d+\)\s*$", text, flags=re.M)
    # blocks = [pre, num1, label1, body1, num2, label2, body2, ...]
    for i in range(1, len(blocks), 3):
        number = int(blocks[i])
        label = blocks[i + 1].strip()
        body = blocks[i + 2]
        spoken = []
        for raw in body.splitlines():
            if raw.startswith("    ") and not raw.strip().startswith("**"):
                spoken.append(raw.strip())
        joined = " ".join(spoken).strip()
        lines.append(Line(number=number, label=label, text=joined))
    if not lines:
        raise ValueError(f"no narration lines parsed from {path}")
    return voice, lines


def parse_storyboard(path: Path) -> list[Frame]:
    text = path.read_text(encoding="utf-8")
    frames: list[Frame] = []
    for m in re.finditer(r"^## Frame (\d+) — (.+)$", text, flags=re.M):
        number = int(m.group(1))
        title = m.group(2).strip()
        # prefer the explicit `- scene:` bullet if present right after the heading
        tail = text[m.end():]
        scene_m = re.search(r"^- scene:\s*(.+)$", tail, flags=re.M)
        scene = scene_m.group(1).strip() if scene_m else title
        frames.append(Frame(number=number, scene=scene))
    return frames


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


def render_title_card(out_png: Path, label: str, scene: str, frame_no: int, total_frames: int) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)

    label_font = ImageFont.truetype(FONT_REGULAR, 36)
    draw.text((120, 100), label, font=label_font, fill=ACCENT)
    draw.line([(120, 150), (120 + int(label_font.getlength(label)), 150)], fill=ACCENT, width=3)

    title_font = ImageFont.truetype(FONT_BOLD, 104)
    wrapped = wrap_text(scene, title_font, WIDTH - 240)
    line_height = 128
    total_h = line_height * len(wrapped)
    start_y = (HEIGHT - total_h) // 2
    for i, line in enumerate(wrapped):
        w = title_font.getlength(line)
        x = (WIDTH - w) / 2
        draw.text((x, start_y + i * line_height), line, font=title_font, fill=FG)

    dash_font = ImageFont.truetype(FONT_REGULAR, 30)
    dash_gap = 44
    total_dash_w = total_frames * 60 + (total_frames - 1) * (dash_gap - 60)
    dash_x = (WIDTH - total_dash_w) / 2
    dash_y = HEIGHT - 140
    for i in range(total_frames):
        color = ACCENT if (i + 1) == frame_no else (60, 68, 76)
        draw.rounded_rectangle(
            [(dash_x, dash_y), (dash_x + 60, dash_y + 10)], radius=5, fill=color
        )
        dash_x += dash_gap + 16
    footer = "企业数字化训练营 · Week1"
    fw = dash_font.getlength(footer)
    draw.text(((WIDTH - fw) / 2, HEIGHT - 90), footer, font=dash_font, fill=MUTED)

    img.save(out_png)


def build_capsule(slug: str, voice_override: str | None) -> dict:
    proj = VIDEOS_DIR / slug
    script_path = proj / "SCRIPT.md"
    storyboard_path = proj / "STORYBOARD.md"
    renders = proj / "renders"
    renders.mkdir(parents=True, exist_ok=True)

    day_capsule = slug.replace("fde-day01-", "day01-")  # e.g. day01-c1
    capsule_id = slug.split("-")[-1]  # c1 / c3 / c4 / c6

    voice, lines = parse_script(script_path)
    voice = voice_override or voice
    frames = parse_storyboard(storyboard_path)
    if len(frames) != len(lines):
        raise ValueError(f"{slug}: {len(frames)} storyboard frames vs {len(lines)} script lines")

    label = CAPSULE_LABELS.get(capsule_id, slug)

    with tempfile.TemporaryDirectory(prefix=f"{slug}-") as tmp_s:
        tmp = Path(tmp_s)
        audio_segments: list[Path] = []
        video_segments: list[Path] = []
        line_durations: list[float] = []

        for line, frame in zip(lines, frames):
            aiff = tmp / f"line{line.number:02d}.aiff"
            run(["say", "-v", voice, "-o", str(aiff), line.text])
            wav = tmp / f"line{line.number:02d}.wav"
            run(["ffmpeg", "-y", "-i", str(aiff), str(wav)])
            dur = ffprobe_duration(wav)
            line_durations.append(dur)
            audio_segments.append(wav)

            png = tmp / f"frame{frame.number:02d}.png"
            render_title_card(png, label, frame.scene, frame.number, len(frames))
            seg_mp4 = tmp / f"seg{frame.number:02d}.mp4"
            run([
                "ffmpeg", "-y", "-loop", "1", "-i", str(png),
                "-t", f"{dur:.3f}", "-r", "30",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=1920:1080",
                str(seg_mp4),
            ])
            video_segments.append(seg_mp4)

        # concat audio segments -> full narration
        audio_list = tmp / "audio_list.txt"
        audio_list.write_text("".join(f"file '{p}'\n" for p in audio_segments))
        full_wav = tmp / "full.wav"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(audio_list), "-c", "copy", str(full_wav)])
        mp3_out = renders / f"{day_capsule}-intro.mp3"
        run(["ffmpeg", "-y", "-i", str(full_wav), "-codec:a", "libmp3lame", "-qscale:a", "4", str(mp3_out)])

        # concat silent video segments
        video_list = tmp / "video_list.txt"
        video_list.write_text("".join(f"file '{p}'\n" for p in video_segments))
        silent_mp4 = tmp / "silent.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(silent_mp4)])

        # mux with final mp3
        mp4_out = renders / f"{day_capsule}-explainer.mp4"
        run([
            "ffmpeg", "-y", "-i", str(silent_mp4), "-i", str(mp3_out),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
            str(mp4_out),
        ])

        total_dur = ffprobe_duration(mp4_out)

        # poster ~1.5s into the video (inside frame 1's window)
        poster_out = renders / f"{day_capsule}-poster.jpg"
        poster_t = min(1.5, max(0.2, line_durations[0] / 2))
        run(["ffmpeg", "-y", "-ss", f"{poster_t:.2f}", "-i", str(mp4_out), "-frames:v", "1", str(poster_out)])

    # build timestamps + transcript
    cum = 0.0
    transcript_lines = []
    frame_starts = []
    for line, frame, dur in zip(lines, frames, line_durations):
        mm, ss = divmod(int(cum), 60)
        frame_starts.append(cum)
        transcript_lines.append(f"{mm:02d}:{ss:02d} {frame.scene}：{line.text.split('。')[0]}。")
        cum += dur
    transcript = "\n".join(transcript_lines)

    manifest = {
        "slug": slug,
        "capsule_id": capsule_id,
        "voice": voice,
        "audio_key": f"documents/camp-v03/course-media/{day_capsule}-intro.mp3",
        "video_key": f"documents/camp-v03/course-media/{day_capsule}-explainer.mp4",
        "poster_key": f"documents/camp-v03/course-media/{day_capsule}-poster.jpg",
        "audio_path": str(mp3_out),
        "video_path": str(mp4_out),
        "poster_path": str(poster_out),
        "duration_sec": round(total_dur, 2),
        "frame_starts_sec": [round(x, 2) for x in frame_starts],
        "transcript": transcript,
    }
    (renders / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*", help="e.g. fde-day01-c1")
    ap.add_argument("--all", action="store_true", help="build all videos/fde-day01-* projects")
    ap.add_argument("--voice", default=None, help="override macOS say voice")
    args = ap.parse_args()

    slugs = args.slugs
    if args.all or not slugs:
        slugs = sorted(p.name for p in VIDEOS_DIR.glob("fde-day01-*") if p.is_dir())

    results = []
    for slug in slugs:
        print(f"== building {slug} ==", file=sys.stderr)
        manifest = build_capsule(slug, args.voice)
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        results.append(manifest)

    print(f"\nBuilt {len(results)} capsule(s).", file=sys.stderr)


if __name__ == "__main__":
    main()
