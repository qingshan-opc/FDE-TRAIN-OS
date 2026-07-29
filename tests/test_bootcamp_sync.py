"""Tests for bootcamp → day package sync."""

from __future__ import annotations

import pytest

from services.author.bootcamp_sync import (
    build_day_package,
    list_available_days,
    merge_day_package,
    preview_day_sync,
)


def test_list_available_days_includes_day6():
    days = list_available_days()
    assert 6 in days


def test_build_day6_c1_has_media_and_cards():
    pkg = build_day_package(6)
    c1 = next(c for c in pkg["learn"]["capsules"] if c["id"] == "c1")
    assert c1.get("media")
    assert len(c1.get("knowledge_cards") or []) >= 1


def test_merge_media_fields_preserves_extra_capsule():
    boot = build_day_package(6)
    existing = {
        "day": 6,
        "title": "Old",
        "nodes": [{"type": "learn", "title": "x"}, {"type": "quiz", "title": "q"}],
        "learn": {
            "capsules": [
                {"id": "c1", "title": "Old c1", "content": "old"},
                {"id": "c99", "title": "Manual", "content": "keep me"},
            ]
        },
    }
    merged = merge_day_package(existing, boot, "media_fields")
    ids = [c["id"] for c in merged["learn"]["capsules"]]
    assert "c99" in ids
    c1 = next(c for c in merged["learn"]["capsules"] if c["id"] == "c1")
    assert c1.get("media")
    assert c1["content"] != "old"


def test_get_bootcamp_capsule_media_day6_c1():
    from services.author.bootcamp_sync import get_bootcamp_capsule_media

    media = get_bootcamp_capsule_media(6, "c1")
    assert isinstance(media, list)


def test_preview_day_sync_dry_run_shape():
    preview = preview_day_sync(None, 6, "full")
    assert preview["day"] == 6
    assert preview["capsule_count"] >= 1
    assert "package_json" in preview
