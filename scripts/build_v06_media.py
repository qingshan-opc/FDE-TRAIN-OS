#!/usr/bin/env python3
"""Build fde-v06 Day1 capsule videos: TTS (macOS say) + 讲解图画面 -> mp4.

Extends scripts/build_course_media.py with diagram frames: a STORYBOARD frame may
carry `- image: <path-to-svg>`; the SVG is rasterized via headless Chrome and
composited onto the standard 1920x1080 dark card (label header + progress dashes).

Slug convention: videos/fde-v06-day01-c{N}/ -> renders/day01-c{N}-*.mp4 etc.
Object keys (manifest): documents/camp-v06/course-media/day01-c{N}-*  — must match
DAY1_MEDIA_PREFIX in scripts/build_v06_contracts.py.

Usage:
  python3 scripts/build_v06_media.py                # all fde-v06-day01-* projects
  python3 scripts/build_v06_media.py fde-v06-day01-c1 ...
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
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))
from services.shared.config import COURSE_MEDIA_SHARED_PREFIX  # noqa: E402

VIDEOS_DIR = ROOT / "videos"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
WIDTH, HEIGHT = 1920, 1080
BG = (11, 15, 20)
ACCENT = (56, 214, 200)
FG = (245, 247, 250)
MUTED = (150, 165, 175)
MEDIA_PREFIX = COURSE_MEDIA_SHARED_PREFIX.rstrip("/")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CAPSULE_LABELS = {
    "c1": "FDE Day1 · 1.1 世界观快通",
    "c2": "FDE Day1 · 1.2 LLM 最小认知",
    "c3": "FDE Day1 · 1.3 四层架构 + 路线",
    "c4": "FDE Day1 · 1.4 环境导览",
    "c5": "FDE Day1 · 1.5 方向卡 + 线框",
    "c6": "FDE Day1 · 1.6 GATE 1 验收",
}


@dataclass
class Line:
    number: int
    label: str
    text: str


@dataclass
class Frame:
    number: int
    scene: str
    image: str | None  # ROOT-relative SVG path, optional


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
        tail = text[m.end():]
        scene_m = re.search(r"^- scene:\s*(.+)$", tail, flags=re.M)
        scene = scene_m.group(1).strip() if scene_m else title
        img_m = re.search(r"^- image:\s*(\S+)\s*$", tail, flags=re.M)
        image = img_m.group(1).strip() if img_m else None
        frames.append(Frame(number=number, scene=scene, image=image))
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


def _draw_chrome(img: Image.Image, label: str, frame_no: int, total_frames: int) -> None:
    """Label header + progress dashes + footer, shared by all frame kinds."""
    draw = ImageDraw.Draw(img)
    label_font = ImageFont.truetype(FONT_REGULAR, 36)
    draw.text((120, 72), label, font=label_font, fill=ACCENT)
    draw.line([(120, 122), (120 + int(label_font.getlength(label)), 122)], fill=ACCENT, width=3)

    dash_gap = 44
    dash_x = (WIDTH - total_frames * dash_gap) / 2
    dash_y = HEIGHT - 120
    for i in range(total_frames):
        color = ACCENT if (i + 1) == frame_no else (60, 68, 76)
        draw.rounded_rectangle(
            [(dash_x, dash_y), (dash_x + 32, dash_y + 8)], radius=4, fill=color
        )
        dash_x += dash_gap
    footer = "FDE 训练营 · Day 1"
    footer_font = ImageFont.truetype(FONT_REGULAR, 28)
    fw = footer_font.getlength(footer)
    draw.text(((WIDTH - fw) / 2, HEIGHT - 78), footer, font=footer_font, fill=MUTED)


def render_title_card(out_png: Path, label: str, scene: str, frame_no: int, total_frames: int) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    _draw_chrome(img, label, frame_no, total_frames)
    draw = ImageDraw.Draw(img)
    title_font = ImageFont.truetype(FONT_BOLD, 100)
    wrapped = wrap_text(scene, title_font, WIDTH - 240)
    line_height = 124
    total_h = line_height * len(wrapped)
    start_y = (HEIGHT - total_h) // 2 - 10
    for i, line in enumerate(wrapped):
        w = title_font.getlength(line)
        draw.text(((WIDTH - w) / 2, start_y + i * line_height), line, font=title_font, fill=FG)
    img.save(out_png)


def _svg_viewbox(svg_path: Path) -> tuple[int, int]:
    m = re.search(r'viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"', svg_path.read_text(encoding="utf-8"))
    if not m:
        return 1040, 820
    return int(float(m.group(1))), int(float(m.group(2)))


def rasterize_svg(svg_path: Path, out_png: Path) -> None:
    """Headless-Chrome screenshot of an SVG at 2x scale, window sized to the viewBox."""
    out_png.parent.mkdir(parents=True, exist_ok=True)
    w, h = _svg_viewbox(svg_path)
    run([
        CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=2",
        f"--screenshot={out_png}",
        f"--window-size={w},{h}",
        f"file://{svg_path}",
    ])


def render_image_card(
    out_png: Path, label: str, scene: str, svg_rel: str, frame_no: int, total_frames: int, tmp: Path
) -> None:
    svg_path = ROOT / svg_rel
    if not svg_path.exists():
        raise FileNotFoundError(f"diagram not found: {svg_path}")
    raw_png = tmp / f"diagram-{frame_no:02d}.png"
    rasterize_svg(svg_path, raw_png)
    diagram = Image.open(raw_png).convert("RGB")

    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    _draw_chrome(img, label, frame_no, total_frames)
    draw = ImageDraw.Draw(img)

    # "projected slide": rounded panel in the diagram's own background color,
    # so light and dark diagrams both look intentional on the dark canvas.
    panel_bg = diagram.getpixel((6, 6))
    max_w, max_h = 1500, HEIGHT - 400  # leave room for header / caption / dashes
    scale = min(max_w / diagram.width, max_h / diagram.height)
    dw, dh = int(diagram.width * scale), int(diagram.height * scale)
    diagram = diagram.resize((dw, dh), Image.LANCZOS)
    pad = 30
    px = (WIDTH - dw) // 2 - pad
    py = 158 + (max_h - dh) // 2 - pad
    draw.rounded_rectangle(
        [(px, py), (px + dw + 2 * pad, py + dh + 2 * pad)], radius=18, fill=panel_bg
    )
    img.paste(diagram, (px + pad, py + pad))

    # caption between panel and progress dashes
    cap_font = ImageFont.truetype(FONT_BOLD, 40)
    cw = cap_font.getlength(scene)
    cap_y = min(py + dh + 2 * pad + 20, HEIGHT - 176)
    draw.text(((WIDTH - cw) / 2, cap_y), scene, font=cap_font, fill=FG)
    img.save(out_png)


def build_capsule(slug: str, voice_override: str | None) -> dict:
    proj = VIDEOS_DIR / slug
    script_path = proj / "SCRIPT.md"
    storyboard_path = proj / "STORYBOARD.md"
    renders = proj / "renders"
    renders.mkdir(parents=True, exist_ok=True)

    capsule_id = slug.split("-")[-1]  # c1..c6
    day_capsule = f"day01-{capsule_id}"

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
            if frame.image:
                render_image_card(png, label, frame.scene, frame.image, frame.number, len(frames), tmp)
            else:
                render_title_card(png, label, frame.scene, frame.number, len(frames))
            seg_mp4 = tmp / f"seg{frame.number:02d}.mp4"
            run([
                "ffmpeg", "-y", "-loop", "1", "-i", str(png),
                "-t", f"{dur:.3f}", "-r", "30",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=1920:1080",
                str(seg_mp4),
            ])
            video_segments.append(seg_mp4)

        audio_list = tmp / "audio_list.txt"
        audio_list.write_text("".join(f"file '{p}'\n" for p in audio_segments))
        full_wav = tmp / "full.wav"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(audio_list), "-c", "copy", str(full_wav)])
        mp3_out = renders / f"{day_capsule}-intro.mp3"
        run(["ffmpeg", "-y", "-i", str(full_wav), "-codec:a", "libmp3lame", "-qscale:a", "4", str(mp3_out)])

        video_list = tmp / "video_list.txt"
        video_list.write_text("".join(f"file '{p}'\n" for p in video_segments))
        silent_mp4 = tmp / "silent.mp4"
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(video_list), "-c", "copy", str(silent_mp4)])

        mp4_out = renders / f"{day_capsule}-explainer.mp4"
        run([
            "ffmpeg", "-y", "-i", str(silent_mp4), "-i", str(mp3_out),
            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
            str(mp4_out),
        ])

        total_dur = ffprobe_duration(mp4_out)

        poster_out = renders / f"{day_capsule}-poster.jpg"
        poster_t = min(1.5, max(0.2, line_durations[0] / 2))
        run(["ffmpeg", "-y", "-ss", f"{poster_t:.2f}", "-i", str(mp4_out), "-frames:v", "1", str(poster_out)])

    cum = 0.0
    transcript_lines = []
    frame_starts = []
    for line, frame, dur in zip(lines, frames, line_durations):
        mm, ss = divmod(int(cum), 60)
        frame_starts.append(cum)
        first_sentence = re.split(r"(?<=[。！？])", line.text)[0]
        transcript_lines.append(f"{mm:02d}:{ss:02d} {frame.scene}：{first_sentence}")
        cum += dur
    transcript = "\n".join(transcript_lines)

    manifest = {
        "slug": slug,
        "capsule_id": capsule_id,
        "voice": voice,
        "audio_key": f"{MEDIA_PREFIX}/{day_capsule}-intro.mp3",
        "video_key": f"{MEDIA_PREFIX}/{day_capsule}-explainer.mp4",
        "poster_key": f"{MEDIA_PREFIX}/{day_capsule}-poster.jpg",
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
    ap.add_argument("slugs", nargs="*", help="e.g. fde-v06-day01-c1")
    ap.add_argument("--voice", default=None, help="override macOS say voice")
    args = ap.parse_args()

    slugs = args.slugs or sorted(p.name for p in VIDEOS_DIR.glob("fde-v06-day01-*") if p.is_dir())

    results = []
    for slug in slugs:
        print(f"== building {slug} ==", file=sys.stderr)
        manifest = build_capsule(slug, args.voice)
        print(f"   duration={manifest['duration_sec']}s -> {manifest['video_path']}", file=sys.stderr)
        results.append(manifest)

    print(json.dumps([{ "slug": m["slug"], "duration_sec": m["duration_sec"] } for m in results], ensure_ascii=False, indent=2))
    print(f"\nBuilt {len(results)} capsule(s).", file=sys.stderr)


if __name__ == "__main__":
    main()
