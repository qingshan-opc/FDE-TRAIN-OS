"""Learning daily stats + day progress count helpers."""

from __future__ import annotations

from services.progress.app import _day_progress_counts, _week_for_day


def test_week_for_day():
    assert _week_for_day(1) == 1
    assert _week_for_day(5) == 1
    assert _week_for_day(6) == 2


def test_day_progress_counts_unique_nodes():
    class FakeCur:
        def execute(self, *_args, **_kwargs):
            return None

        def fetchall(self):
            return [
                {"node_id": "d1-learn", "status": "passed"},
                {"node_id": "d1-learn", "status": "passed"},
                {"node_id": "d1-quiz", "status": "passed"},
                {"node_id": "d1-lab", "status": "available"},
                {"node_id": "d1-unlock", "status": "passed"},
            ]

    passed, total = _day_progress_counts(FakeCur(), "u1", "camp-v03", 1)
    assert passed == 2
    assert total == 3
