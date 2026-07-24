"""Unit tests for anyCode Workbench client helpers."""

from __future__ import annotations

from services.shared import anycode_client as ac


def test_anycode_headers_without_token(monkeypatch):
    monkeypatch.setattr(ac, "ANYCODE_API_TOKEN", "")
    h = ac.anycode_headers()
    assert "Authorization" not in h
    assert h["Accept"] == "application/json"


def test_anycode_headers_with_token(monkeypatch):
    monkeypatch.setattr(ac, "ANYCODE_API_TOKEN", "tok_test")
    h = ac.anycode_headers()
    assert h["Authorization"] == "Bearer tok_test"


def test_parse_sse_chat_events():
    lines = iter(
        [
            "event: chat_event",
            'data: {"kind":"assistant_delta","text":"你好"}',
            "",
            "event: chat_event",
            'data: {"kind":"turn_done"}',
            "",
        ]
    )
    events = list(ac._parse_sse_chunks(lines))
    assert events[0][0] == "chat_event"
    assert events[0][1]["kind"] == "assistant_delta"
    assert events[0][1]["text"] == "你好"
    assert events[1][1]["kind"] == "turn_done"


def test_coach_sandbox_path(tmp_path, monkeypatch):
    monkeypatch.setattr(ac, "DATA_DIR", tmp_path)
    p = ac.coach_sandbox_path()
    assert p.exists()
    assert (p / ".fde-coach").exists()
