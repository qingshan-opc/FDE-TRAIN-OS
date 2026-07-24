"""Integration — MinIO workspace hydrate / snapshot roundtrip."""

from __future__ import annotations

from pathlib import Path

import pytest

from services.storage import get_store, hydrate_workspace, snapshot_workspace, temp_workspace


@pytest.mark.usefixtures("require_minio")
def test_snapshot_hydrate_roundtrip(unique_suffix: str, tmp_path: Path):
    get_store().ensure_buckets()
    camp_id = "camp-v03"
    learner_id = f"snap-{unique_suffix}"
    src = tmp_path / "ws"
    src.mkdir()
    (src / "index.html").write_text("<h1>hello</h1>", encoding="utf-8")
    (src / "notes").mkdir()
    (src / "notes" / "a.txt").write_text("note", encoding="utf-8")
    deep = src / "src" / "lib" / "nested"
    deep.mkdir(parents=True)
    (deep / "util.js").write_text("export const n=1\n", encoding="utf-8")

    snap = snapshot_workspace(camp_id, learner_id, src, job_id=f"job-{unique_suffix}")
    assert snap["file_count"] == 3
    assert snap["size_bytes"] > 0

    dest = temp_workspace(camp_id, learner_id, f"hydrate-{unique_suffix}")
    count = hydrate_workspace(camp_id, learner_id, snap["id"], dest)
    assert count == 3
    assert (dest / "index.html").read_text(encoding="utf-8") == "<h1>hello</h1>"
    assert (dest / "notes" / "a.txt").read_text(encoding="utf-8") == "note"
    assert (dest / "src" / "lib" / "nested" / "util.js").read_text(encoding="utf-8") == "export const n=1\n"


@pytest.mark.usefixtures("require_minio")
def test_hydrate_empty_snapshot(unique_suffix: str):
    dest = temp_workspace("camp-v03", f"empty-{unique_suffix}", "h0")
    count = hydrate_workspace("camp-v03", f"empty-{unique_suffix}", None, dest)
    assert count == 0
    assert dest.exists()
