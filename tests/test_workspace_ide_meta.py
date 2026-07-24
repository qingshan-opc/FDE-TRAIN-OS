"""Unit tests for IDE workspace path safety + file metadata (no live MinIO)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi import HTTPException

from services.agent_gateway.app import _file_meta, _safe_rel
from services.shared import resolve_safe


def test_safe_rel_rejects_traversal():
    with pytest.raises(HTTPException):
        _safe_rel("../etc/passwd")
    with pytest.raises(HTTPException):
        _safe_rel("a/../../b")
    with pytest.raises(HTTPException):
        _safe_rel("")
    assert _safe_rel("/notes/README.md") == "notes/README.md"


def test_file_meta_language_and_binary():
    html = _file_meta("index.html", 12)
    assert html["kind"] == "text"
    assert html["editable"] is True
    assert html["language"] == "html"

    md = _file_meta("docs/README.md", 40)
    assert md["language"] == "markdown"

    yaml_m = _file_meta("k8s/deployment.yaml", 100)
    assert yaml_m["language"] == "yaml"

    png = _file_meta("logo.png", 2048)
    assert png["kind"] == "binary"
    assert png["editable"] is False


def test_nested_dirs_resolve_safe():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        nested = root / "src" / "lib"
        nested.mkdir(parents=True)
        (nested / "app.js").write_text("console.log(1)", encoding="utf-8")
        p = resolve_safe(root, "src/lib/app.js")
        assert p.read_text(encoding="utf-8") == "console.log(1)"
        with pytest.raises(ValueError):
            resolve_safe(root, "../outside.txt")
