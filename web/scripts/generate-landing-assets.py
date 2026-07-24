#!/usr/bin/env python3
"""Generate landing hero + story posters via Agnes Image API."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "landing"
MANIFEST = OUT / "manifest.json"
AGNES_URL = "https://apihub.agnes-ai.com/v1/images/generations"

ASSETS = [
    {
        "id": "hero",
        "size": "1792x1024",
        "prompt": (
            "Cinematic wide landscape photograph, QingShan Lake science park at golden hour, "
            "modern training campus with glass buildings and mountains reflected in calm water, "
            "teal and emerald natural tones, professional corporate education brand mood, "
            "photorealistic, ultra clean composition, no text, no logo, no watermark"
        ),
    },
    {
        "id": "story-task",
        "size": "1024x576",
        "prompt": (
            "Documentary photo of a professional digital training workshop, diverse young professionals "
            "collaborating around laptops in a bright modern classroom, task boards on wall, "
            "teal accent lighting, realistic, no text"
        ),
    },
    {
        "id": "story-agent",
        "size": "1024x576",
        "prompt": (
            "Cinematic photo of an AI agent training lab, developer working in isolated workspace "
            "with multiple monitors showing code and agent workflow, dark elegant UI glow, "
            "professional tech education, no text"
        ),
    },
    {
        "id": "story-cert",
        "size": "1024x576",
        "prompt": (
            "Professional graduation and certification scene, trainer handing digital certificate tablet "
            "to trainee in modern enterprise training room, warm natural light, trustworthy corporate "
            "education atmosphere, no text"
        ),
    },
]


def load_api_key() -> str:
    for env_path in (
        ROOT.parent / ".env",
        Path.home() / "workspace/research/litu-miniapp/deploy/runtime.env",
        Path.home() / "workspace/research/digital-lingzhi-platform/deploy/.env",
    ):
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            if line.startswith("AGNES_API_KEY="):
                key = line.split("=", 1)[1].strip()
                if key:
                    return key
    key = os.environ.get("AGNES_API_KEY", "").strip()
    if key:
        return key
    raise SystemExit("AGNES_API_KEY not found in env or sibling deploy files")


def generate_one(api_key: str, asset: dict) -> str:
    payload = json.dumps(
        {
            "model": "agnes-image-2.1-flash",
            "prompt": asset["prompt"],
            "size": asset["size"],
        }
    ).encode()
    req = urllib.request.Request(
        AGNES_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read())
    first = (body.get("data") or [{}])[0]
    url = first.get("url")
    if not url:
        raise RuntimeError(f"empty url: {body}")
    return url


def download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url, timeout=180) as resp:
        dest.write_bytes(resp.read())


def main() -> int:
    only = set(sys.argv[1:])
    api_key = load_api_key()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, str] = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())

    ok, skip, fail = 0, 0, 0
    for asset in ASSETS:
        aid = asset["id"]
        if only and aid not in only:
            continue
        dest = OUT / f"{aid}.png"
        if dest.exists() and dest.stat().st_size > 10_000 and aid in manifest:
            print(f"skip {aid}")
            skip += 1
            continue
        print(f"generating {aid} ...")
        try:
            url = generate_one(api_key, asset)
            download(url, dest)
            manifest[aid] = f"/landing/{aid}.png"
            print(f"  saved {dest.name} ({dest.stat().st_size // 1024} KB)")
            ok += 1
            time.sleep(1.5)
        except Exception as exc:  # noqa: BLE001
            print(f"  failed {aid}: {exc}")
            fail += 1

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"ok": ok, "skip": skip, "fail": fail, "manifest": manifest}, ensure_ascii=False, indent=2))
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
