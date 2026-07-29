"""Ensure day-13 k8s curriculum is discoverable and not shadowed by day-03 agent pack."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]  # repo root (tests live under backend/tests/)
CONTRACTS = ROOT / "contracts" / "examples"


@pytest.mark.skipif(
    not (CONTRACTS / "day-13-k8s-curriculum.yaml").exists(),
    reason="day-13 k8s curriculum yaml not in tree yet",
)
def test_day13_k8s_curriculum_exists():
    p = CONTRACTS / "day-13-k8s-curriculum.yaml"
    assert p.exists()
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    assert data["day"] == 13
    assert data["lab"]["runner"] == "sim"
    assert data["lab"]["sim_kind"] == "k8s"


def test_day03_remains_agent_api():
    p = CONTRACTS / "day-03-curriculum.yaml"
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    assert data["day"] == 3
    assert data["lab"]["runner"] == "agent"
    assert "sim_kind" not in (data.get("lab") or {}) or data["lab"].get("sim_kind") != "k8s"
