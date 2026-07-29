#!/usr/bin/env python3
"""Upload videos/fde-day01-*/renders/* to MinIO under documents/camp-v03/course-media/.

Reads S3 config the same way services.storage does (services.shared.config env vars,
which fall back to sane dev defaults matching docker-compose). Uses services.storage
directly so this stays in sync with the rest of the platform's object-store wiring.

Usage:
  python3 scripts/upload_course_media.py [fde-day01-c1 ...]   # default: all videos/fde-day01-*
  python3 scripts/upload_course_media.py --verify-only
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.shared.config import COURSE_MEDIA_SHARED_PREFIX, S3_BUCKET_DOCUMENTS  # noqa: E402
from services.storage import get_store  # noqa: E402

VIDEOS_DIR = ROOT / "videos"
PREFIX = COURSE_MEDIA_SHARED_PREFIX.rstrip("/")

CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def upload_capsule(slug: str, store, prefix: str = PREFIX) -> list[dict]:
    renders = VIDEOS_DIR / slug / "renders"
    if not renders.exists():
        print(f"skip {slug}: no renders/ dir (run build_course_media.py first)", file=sys.stderr)
        return []
    uploaded = []
    for path in sorted(renders.iterdir()):
        if path.suffix not in CONTENT_TYPES:
            continue
        key = f"{prefix}/{path.name}"
        ctype = CONTENT_TYPES[path.suffix]
        ref = store.put_file(S3_BUCKET_DOCUMENTS, key, path, content_type=ctype)
        uploaded.append({
            "file": str(path),
            "bucket": S3_BUCKET_DOCUMENTS,
            "key": key,
            "size_bytes": ref.size_bytes,
            "sha256": ref.sha256,
        })
        print(f"  uploaded s3://{S3_BUCKET_DOCUMENTS}/{key} ({ref.size_bytes} bytes)")
    return uploaded


def verify(keys: list[str], store) -> None:
    print("\n== verify (head_object) ==")
    for key in keys:
        try:
            head = store.head(S3_BUCKET_DOCUMENTS, key)
            print(f"  OK   {key}  ({head.get('ContentLength')} bytes, {head.get('ContentType')})")
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL {key}  {exc}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--verify-only", action="store_true")
    ap.add_argument("--prefix", default=PREFIX, help="object-key prefix, e.g. documents/camp-v06/course-media")
    ap.add_argument("--pattern", default="fde-day01-*", help="videos/ glob, e.g. fde-v06-day01-*")
    args = ap.parse_args()

    slugs = args.slugs or sorted(p.name for p in VIDEOS_DIR.glob(args.pattern) if p.is_dir())
    store = get_store()

    if args.verify_only:
        keys = []
        for slug in slugs:
            renders = VIDEOS_DIR / slug / "renders"
            if renders.exists():
                keys += [f"{args.prefix}/{p.name}" for p in renders.iterdir() if p.suffix in CONTENT_TYPES]
        verify(keys, store)
        return

    all_uploaded = []
    for slug in slugs:
        print(f"== uploading {slug} ==")
        all_uploaded += upload_capsule(slug, store, args.prefix)

    keys = [u["key"] for u in all_uploaded]
    verify(keys, store)

    print("\n== summary (json) ==")
    print(json.dumps(all_uploaded, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
