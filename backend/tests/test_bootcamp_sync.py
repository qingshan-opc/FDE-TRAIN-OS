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


def test_build_day1_capsules_project_four_step_local_practice():
    pkg = build_day_package(1)
    capsules = pkg["learn"]["capsules"]
    assert len(capsules) >= 5
    for capsule in capsules:
        prep = capsule.get("local_prep") or {}
        assert prep.get("checklist")
        # c1 is knowledge-only; later capsules carry hands-on prep (prompt optional).


def test_week2_cockpit_prompts_project_into_local_prep():
    """Teaching-pack markdown links must become copyable local_prep prompts."""
    pkg7 = build_day_package(7)
    ids = [c["id"] for c in pkg7["learn"]["capsules"]]
    assert "c0" not in ids
    c1 = next(c for c in pkg7["learn"]["capsules"] if c["id"] == "c1")
    assert (c1.get("local_prep") or {}).get("codex_prompt")
    assert "SSE" in (c1["local_prep"]["codex_prompt"] or "") or "助手" in (c1["local_prep"]["codex_prompt"] or "") or "对话" in (
        c1["local_prep"]["codex_prompt"] or ""
    )

    pkg5 = build_day_package(5)
    c6 = next(c for c in pkg5["learn"]["capsules"] if c["id"] == "c6")
    prompt = (c6.get("local_prep") or {}).get("codex_prompt") or ""
    assert "驾驶舱桥接" not in prompt
    assert not any("周末" in x for x in (c6.get("local_prep") or {}).get("checklist") or [])
    assert "驾驶舱" not in (pkg5.get("project_brief") or "")


def test_week1_copy_prompts_are_actionable_local_prep():
    """Most Week1 capsules expose local_prep with a checklist and/or copy prompt."""
    with_prep = 0
    for day in range(1, 6):
        pkg = build_day_package(day)
        assert len(pkg["learn"]["capsules"]) >= 5
        for capsule in pkg["learn"]["capsules"]:
            prep = capsule.get("local_prep") or {}
            if prep.get("checklist") or (prep.get("codex_prompt") or "").strip():
                with_prep += 1
    assert with_prep >= 20


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
