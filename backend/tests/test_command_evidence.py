"""Unit tests for command / acceptance evidence helpers."""

from __future__ import annotations

from pathlib import Path

import pytest

from services.shared.command_evidence import (
    CAPABILITY_TAG,
    build_lab_capability_tags,
    command_acceptance_score,
    parse_command_log_stats,
)


def test_build_lab_capability_tags_pass_includes_command_capability():
    tags = build_lab_capability_tags(day=1, passed=True, evidence_kind="agent")
    assert "eval:agent" in tags
    assert "pass" in tags
    assert "day:1" in tags
    assert CAPABILITY_TAG in tags
    assert "command:day:1" in tags


def test_build_lab_capability_tags_fail_excludes_command_capability():
    tags = build_lab_capability_tags(day=2, passed=False, evidence_kind="agent")
    assert "fail" in tags
    assert CAPABILITY_TAG not in tags
    assert "command:day:2" not in tags


def test_parse_command_log_stats():
    text = """
# Day 1 指挥日志
- 岗位: 产品经理 | 状态: REJECTED | 问题: 缺验收标准
- 岗位: 产品经理 | 状态: APPROVED
我确认以上批准均为本人作出，Agent 未替我判定通过。
"""
    stats = parse_command_log_stats(text)
    assert stats["approved"] >= 1
    assert stats["rejected"] >= 1
    assert "产品经理" in stats["roles"]


def test_command_acceptance_score():
    tags = {"command:day:1", "command:day:3", "pass"}
    assert command_acceptance_score(tags) == 40


def test_evaluate_workspace_with_command_log(tmp_path: Path):
    from services.agent_gateway.app import _evaluate_workspace

    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "D1_command_log.md").write_text(
        "\n".join(
            [
                "- 岗位: 产品经理 | 状态: REJECTED",
                "- 岗位: 产品经理 | 状态: APPROVED",
                "我确认以上批准均为本人作出，Agent 未替我判定通过。",
            ]
        ),
        encoding="utf-8",
    )
    (docs / "PRD.md").write_text("验收标准：用户能提交", encoding="utf-8")
    (tmp_path / "design" / "prototypes").mkdir(parents=True)
    (tmp_path / "design" / "prototypes" / "index.html").write_text("<html></html>", encoding="utf-8")
    (docs / "D1_团队协作卡.md").write_text("ok", encoding="utf-8")
    (docs / "D1_项目任务书.md").write_text("ok", encoding="utf-8")

    rubric = [
        {"check": "file_exists", "args": {"path": "docs/D1_团队协作卡.md"}},
        {"check": "file_exists", "args": {"path": "docs/D1_项目任务书.md"}},
        {"check": "text_contains", "args": {"path": "docs/PRD.md", "needle": "验收标准"}},
        {"check": "file_exists", "args": {"path": "design/prototypes/index.html"}},
        {"check": "file_exists", "args": {"path": "docs/D1_command_log.md"}},
        {"check": "text_contains", "args": {"path": "docs/D1_command_log.md", "needle": "REJECTED"}},
        {"check": "text_contains", "args": {"path": "docs/D1_command_log.md", "needle": "APPROVED"}},
        {
            "check": "text_contains",
            "args": {"path": "docs/D1_command_log.md", "needle": "我确认以上批准均为本人作出"},
        },
    ]
    result = _evaluate_workspace(tmp_path, rubric)
    assert result["pass"] is True
    assert result.get("command_stats", {}).get("rejected", 0) >= 1


def test_evaluate_workspace_missing_command_log_fails(tmp_path: Path):
    from services.agent_gateway.app import _evaluate_workspace

    rubric = [
        {"check": "file_exists", "args": {"path": "docs/D1_command_log.md"}},
        {"check": "text_contains", "args": {"path": "docs/D1_command_log.md", "needle": "REJECTED"}},
    ]
    result = _evaluate_workspace(tmp_path, rubric)
    assert result["pass"] is False
