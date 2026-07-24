"""Unit tests for the Chinese rubric registry (M3 explainable eval).

Pure unit tests — no DB, no FastAPI — mirrors the "dependency-free" design
goal of ``services.shared.rubric_registry``.
"""

from __future__ import annotations

from services.shared.rubric_registry import (
    REGISTRY,
    attach_rubric_args,
    enrich_eval_result,
    enrich_rubric_item,
    enrich_rubric_list,
    get_spec,
)


def test_registry_covers_all_canonical_checks():
    expected = {
        "file_exists",
        "text_contains",
        "dom_contains",
        "port_listening",
        "command_sequence",
        "file_contains",
        "constraints_satisfied",
        "decision_note_min_chars",
        "required_components",
        "resource_exists",
        "resource_ready",
    }
    assert expected.issubset(REGISTRY.keys())
    for check_id, spec in REGISTRY.items():
        assert spec.check_id == check_id
        assert spec.title_zh
        assert spec.description_zh
        assert isinstance(spec.weight, float)
        assert isinstance(spec.learner_visible, bool)


def test_get_spec_unknown_returns_none():
    assert get_spec("does_not_exist") is None
    assert get_spec("") is None


def test_enrich_rubric_item_adds_chinese_fields():
    item = {"check": "file_exists", "args": {"path": "index.html"}}
    out = enrich_rubric_item(item)

    # Original fields preserved.
    assert out["check"] == "file_exists"
    assert out["args"] == {"path": "index.html"}

    # New Chinese fields added.
    assert out["title_zh"] == "文件存在"
    assert "index.html" in out["expectation"]
    assert "index.html" in out["hint"]
    assert out["learner_visible"] is True
    assert out["weight"] == 1.0

    # Original dict is untouched (enrich returns a new dict).
    assert "title_zh" not in item


def test_enrich_rubric_item_unknown_check_gets_fallback():
    item = {"check": "some_future_check", "args": {}}
    out = enrich_rubric_item(item)
    assert out["title_zh"] == "some_future_check"
    assert out["description_zh"]
    assert out["hint"] == ""


def test_enrich_rubric_item_non_dict_passthrough():
    assert enrich_rubric_item("not-a-dict") == "not-a-dict"  # type: ignore[arg-type]


def test_enrich_rubric_list():
    items = [
        {"check": "file_exists", "args": {"path": "a.html"}},
        {"check": "text_contains", "args": {"path": "a.html", "needle": "hello"}},
        "skip-me-not-a-dict",
    ]
    out = enrich_rubric_list(items)  # type: ignore[arg-type]
    assert len(out) == 2
    assert out[0]["title_zh"] == "文件存在"
    assert out[1]["title_zh"] == "文本包含指定内容"


def test_enrich_rubric_list_none_input():
    assert enrich_rubric_list(None) == []


def test_command_sequence_expectation_lists_all_commands():
    spec = get_spec("command_sequence")
    assert spec is not None
    text = spec.format_expectation({"contains": ["git init", "git add .", "git commit"]})
    assert "git init" in text
    assert "git commit" in text


def test_decision_note_min_chars_suggestion_includes_minimum():
    spec = get_spec("decision_note_min_chars")
    assert spec is not None
    suggestion = spec.suggest_fix({"min": 200}, actual="当前 40 字")
    assert "200" in suggestion
    assert "当前 40 字" in suggestion


def test_attach_rubric_args_zips_by_position():
    rubric = [
        {"check": "file_exists", "args": {"path": "index.html"}},
        {"check": "text_contains", "args": {"path": "index.html", "needle": "hi"}},
    ]
    result = {
        "pass": False,
        "checks": [
            {"id": "file_exists", "ok": True, "detail": "exists"},
            {"id": "text_contains", "ok": False, "detail": "missing"},
        ],
        "score": 0.5,
    }
    out = attach_rubric_args(result, rubric)
    assert out["checks"][0]["args"] == {"path": "index.html"}
    assert out["checks"][1]["args"] == {"path": "index.html", "needle": "hi"}


def test_attach_rubric_args_noop_when_no_rubric():
    result = {"pass": True, "checks": [{"id": "file_exists", "ok": True}]}
    out = attach_rubric_args(result, None)
    assert out is result
    assert "args" not in out["checks"][0]


def test_attach_rubric_args_does_not_override_existing_args():
    rubric = [{"check": "file_exists", "args": {"path": "should-not-be-used.html"}}]
    result = {"checks": [{"id": "file_exists", "ok": True, "args": {"path": "already-set.html"}}]}
    out = attach_rubric_args(result, rubric)
    assert out["checks"][0]["args"] == {"path": "already-set.html"}


def test_enrich_eval_result_pass_has_no_suggestion():
    result = {
        "pass": True,
        "checks": [{"id": "file_exists", "ok": True, "detail": "index.html exists=True", "args": {"path": "index.html"}}],
        "score": 1.0,
    }
    out = enrich_eval_result(result)
    check = out["checks"][0]
    assert check["title_zh"] == "文件存在"
    assert check["suggestion"] == ""
    assert out["weighted_score"] == 1.0


def test_enrich_eval_result_fail_has_suggestion():
    result = {
        "pass": False,
        "checks": [
            {"id": "text_contains", "ok": False, "detail": "needle not found", "args": {"path": "a.html", "needle": "hi"}},
        ],
        "score": 0.0,
    }
    out = enrich_eval_result(result)
    check = out["checks"][0]
    assert check["ok"] is False
    assert check["suggestion"]
    assert "hi" in check["suggestion"]
    assert "needle not found" in check["suggestion"]
    assert out["weighted_score"] == 0.0


def test_enrich_eval_result_mixed_checks_weighted_score():
    result = {
        "pass": False,
        "checks": [
            {"id": "file_exists", "ok": True, "args": {"path": "a.html"}},
            {"id": "text_contains", "ok": False, "args": {"path": "a.html", "needle": "hi"}},
        ],
        "score": 0.5,
    }
    out = enrich_eval_result(result)
    assert out["weighted_score"] == 0.5  # both checks weight 1.0 -> 1/2 passed


def test_enrich_eval_result_unknown_check_gets_fallback_suggestion():
    result = {"pass": False, "checks": [{"id": "brand_new_check", "ok": False, "detail": "nope"}]}
    out = enrich_eval_result(result)
    check = out["checks"][0]
    assert check["title_zh"] == "brand_new_check"
    assert check["suggestion"]


def test_enrich_eval_result_is_idempotent():
    result = {"pass": True, "checks": [{"id": "file_exists", "ok": True, "args": {"path": "a.html"}}], "score": 1.0}
    once = enrich_eval_result(result)
    twice = enrich_eval_result(once)
    assert once == twice


def test_enrich_eval_result_non_list_checks_passthrough():
    result = {"pass": True, "score": 1.0}
    assert enrich_eval_result(result) == result


def test_enrich_eval_result_non_dict_checks_entries_preserved():
    result = {"checks": ["not-a-dict"]}
    out = enrich_eval_result(result)
    assert out["checks"] == ["not-a-dict"]
