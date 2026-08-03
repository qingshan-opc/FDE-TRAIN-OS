#!/usr/bin/env python3
"""Verify / upload bootcamp course-media into MinIO.

Reads object_key / poster_key from class/bootcamp/day-*/day.yaml (and optional
contracts/examples day-*-curriculum.yaml). For each key:
  - head Object in S3_BUCKET_DOCUMENTS
  - if missing (or --force) and a local render/poster exists, upload it

Local render discovery (slug = basename without extension):
  class/bootcamp/day-NN/section-*/video/renders/<slug>.mp4
  /tmp/<slug>-poster.jpg or renders/<slug>-poster.jpg

Usage:
  .venv/bin/python scripts/sync_course_media_to_minio.py --verify-only
  .venv/bin/python scripts/sync_course_media_to_minio.py
  .venv/bin/python scripts/sync_course_media_to_minio.py --force --days 6,7
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

from services.shared.config import S3_BUCKET_DOCUMENTS  # noqa: E402
from services.storage import get_store  # noqa: E402


def _collect_keys(days: set[int] | None) -> list[str]:
    keys: set[str] = set()
    for p in sorted((ROOT / "class" / "bootcamp").glob("day-*/day.yaml")):
        day_n = int(p.parent.name.split("-")[1])
        if days is not None and day_n not in days:
            continue
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        for extra in (data.get("capsule_extra") or {}).values():
            for m in extra.get("media") or []:
                if m.get("object_key"):
                    keys.add(m["object_key"])
                if m.get("poster_key"):
                    keys.add(m["poster_key"])
    for p in sorted((ROOT / "contracts" / "examples").glob("day-*-curriculum.yaml")):
        try:
            day_n = int(p.name.split("-")[1])
        except (IndexError, ValueError):
            continue
        if days is not None and day_n not in days:
            continue
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        for node in data.get("nodes") or []:
            for cap in node.get("capsules") or []:
                media = cap.get("media") or {}
                items = media if isinstance(media, list) else [media]
                for m in items:
                    if not isinstance(m, dict):
                        continue
                    if m.get("object_key"):
                        keys.add(m["object_key"])
                    if m.get("poster_key"):
                        keys.add(m["poster_key"])
    return sorted(keys)


def _find_local(key: str, source_dir: Path | None = None) -> Path | None:
    name = key.rsplit("/", 1)[-1]
    if source_dir is not None:
        direct = source_dir / name
        if direct.is_file():
            return direct
    if name.endswith(".mp4"):
        hits = list((ROOT / "class" / "bootcamp").glob(f"day-*/section-*/video/renders/{name}"))
        if hits:
            return max(hits, key=lambda p: p.stat().st_mtime)
    if name.endswith(".jpg") or name.endswith(".jpeg") or name.endswith(".png"):
        hits = list((ROOT / "class" / "bootcamp").glob(f"day-*/section-*/video/renders/{name}"))
        if hits:
            return max(hits, key=lambda p: p.stat().st_mtime)
        tmp = Path(f"/tmp/{name}")
        if tmp.is_file():
            return tmp
    # legacy day01 videos/ tree
    legacy = ROOT / "videos"
    if legacy.is_dir():
        hits = list(legacy.glob(f"**/renders/{name}")) + list(legacy.glob(f"**/{name}"))
        if hits:
            return max(hits, key=lambda p: p.stat().st_mtime)
    return None


def _ctype(path: Path) -> str:
    suf = path.suffix.lower()
    if suf == ".mp4":
        return "video/mp4"
    if suf == ".mp3":
        return "audio/mpeg"
    if suf in (".jpg", ".jpeg"):
        return "image/jpeg"
    if suf == ".png":
        return "image/png"
    return "application/octet-stream"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--verify-only", action="store_true")
    ap.add_argument("--force", action="store_true", help="re-upload even if object exists")
    ap.add_argument("--days", default="", help="comma days e.g. 1,6,7 (default: all)")
    ap.add_argument(
        "--source-dir",
        default="",
        help="flat directory of rendered mp4/jpg keyed by basename (e.g. USB export)",
    )
    args = ap.parse_args()
    days = {int(x) for x in args.days.split(",") if x.strip()} or None
    source_dir = Path(args.source_dir).expanduser().resolve() if args.source_dir else None
    if source_dir is not None and not source_dir.is_dir():
        raise SystemExit(f"--source-dir not found: {source_dir}")

    keys = _collect_keys(days)
    store = get_store()
    store.ensure_buckets()
    client = store._client

    present = missing = uploaded = skipped = 0
    missing_keys: list[str] = []
    for key in keys:
        exists = False
        try:
            client.head_object(Bucket=S3_BUCKET_DOCUMENTS, Key=key)
            exists = True
            present += 1
        except Exception:
            missing += 1
            missing_keys.append(key)

        if args.verify_only:
            continue
        if exists and not args.force:
            skipped += 1
            continue
        local = _find_local(key, source_dir)
        if not local:
            print(f"NO_LOCAL {key}")
            continue
        store.put_file(S3_BUCKET_DOCUMENTS, key, local, content_type=_ctype(local))
        uploaded += 1
        print(f"OK {key} <- {local.relative_to(ROOT) if local.is_relative_to(ROOT) else local}")

    print(
        f"summary keys={len(keys)} present={present} missing={missing} "
        f"uploaded={uploaded} skipped={skipped}"
    )
    if args.verify_only and missing_keys:
        for k in missing_keys[:30]:
            print(f"MISSING {k}")
        if len(missing_keys) > 30:
            print(f"... +{len(missing_keys) - 30} more")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
