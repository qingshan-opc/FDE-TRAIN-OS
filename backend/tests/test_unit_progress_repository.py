"""Unit smoke for ProgressRepository helpers (no DB — pure map logic via fake rows)."""

from __future__ import annotations

from types import SimpleNamespace


def test_day_passed_total_excludes_unlock():
    from services.repositories.progress_repository import ProgressRepository

    class FakeSession:
        pass

    repo = ProgressRepository(FakeSession())  # type: ignore[arg-type]
    rows = [
        SimpleNamespace(node_id="d1-learn", status="passed"),
        SimpleNamespace(node_id="d1-quiz", status="available"),
        SimpleNamespace(node_id="d1-unlock", status="passed"),
    ]
    repo.list_for_day = lambda *_a, **_k: rows  # type: ignore[method-assign]
    passed, total = repo.day_passed_total("u", "c", 1)
    assert total == 2
    assert passed == 1


def test_progress_map_keys():
    from services.repositories.progress_repository import ProgressRepository

    class FakeSession:
        pass

    repo = ProgressRepository(FakeSession())  # type: ignore[arg-type]
    rows = [
        SimpleNamespace(day=1, node_id="d1-learn", status="passed"),
        SimpleNamespace(day=2, node_id="d2-lab", status="locked"),
    ]
    repo.list_for_camp = lambda *_a, **_k: rows  # type: ignore[method-assign]
    m = repo.progress_map("u", "c")
    assert m[(1, "d1-learn")] == "passed"
    assert m[(2, "d2-lab")] == "locked"
