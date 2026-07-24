"""Curriculum projection unit tests."""

from __future__ import annotations

import pytest

from services.application.curriculum_projection import project_day_package


def test_duplicate_node_kind_raises_value_error():
    pkg = {
        "day": 7,
        "title": "dup",
        "nodes": [
            {"type": "lab", "title": "L1"},
            {"type": "lab", "title": "L2"},
        ],
        "lab": {},
    }
    with pytest.raises(ValueError, match="重复"):
        project_day_package("nonexistent-version-for-projection-test", 7, pkg)
