"""Learning daily stats + day progress helpers."""

from __future__ import annotations

from services.progress.app import _week_for_day


def test_week_for_day():
    assert _week_for_day(1) == 1
    assert _week_for_day(5) == 1
    assert _week_for_day(6) == 2
