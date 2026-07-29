#!/usr/bin/env python3
"""Upload section render mp4 + poster; update day.yaml duration_sec."""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs  # noqa: E402


def probe_duration(mp4: Path) -> int:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(mp4)],
        capture_output=True, text=True, check=True,
    )
    return int(round(float(r.stdout.strip())))


def upload(day: int, sec: str, mp4: Path | None = None) -> None:
    mapping = section_dirs(day)
    sec = sec.zfill(2)
    section_path = BC / f"day-{day:02d}" / mapping[sec]
    video = section_path / "video"
    if mp4 is None:
        renders = list((video / "renders").glob("*.mp4"))
        if not renders:
            raise SystemExit(f"no mp4 in {video / 'renders'}")
        mp4 = max(renders, key=lambda p: p.stat().st_mtime)

    yaml_path = BC / f"day-{day:02d}" / "day.yaml"
    data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    cap_key = f"c{int(sec)}"
    extra = data.get("capsule_extra", {}).get(cap_key, {})
    media_list = extra.get("media") or []
    if not media_list:
        raise SystemExit(f"no media in {yaml_path} {cap_key}")
    object_key = media_list[0]["object_key"]
    slug = object_key.rsplit("/", 1)[-1].replace(".mp4", "")

    from services.storage import get_store
    from services.shared.config import COURSE_MEDIA_SHARED_PREFIX, S3_BUCKET_DOCUMENTS

    store = get_store()
    poster = Path(f"/tmp/{slug}-poster.jpg")
    subprocess.run(
        ["ffmpeg", "-y", "-ss", "8", "-i", str(mp4), "-frames:v", "1", "-q:v", "3", str(poster)],
        check=True, capture_output=True,
    )
    prefix = COURSE_MEDIA_SHARED_PREFIX.rstrip("/")
    for path, key, ctype in [
        (mp4, f"{prefix}/{slug}.mp4", "video/mp4"),
        (poster, f"{prefix}/{slug}-poster.jpg", "image/jpeg"),
    ]:
        ref = store.put_file(S3_BUCKET_DOCUMENTS, key, path, content_type=ctype)
        print("OK", key, ref.size_bytes)

    dur = probe_duration(mp4)
    data["capsule_extra"][cap_key]["media"][0]["duration_sec"] = dur
    yaml_path.write_text(yaml.dump(data, allow_unicode=True, sort_keys=False, width=120), encoding="utf-8")
    print(f"updated {yaml_path} {cap_key} duration_sec={dur}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, required=True)
    ap.add_argument("--section", required=True)
    ap.add_argument("--mp4", default="")
    args = ap.parse_args()
    upload(args.day, args.section, Path(args.mp4) if args.mp4 else None)


if __name__ == "__main__":
    main()
