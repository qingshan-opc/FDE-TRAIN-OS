"""Chinese-language rubric registry — canonical evaluator metadata + enrichment.

Single source of truth mapping a rubric ``check`` id (e.g. ``file_exists``) to
a Chinese title, description, "what is expected" sentence and a concrete
fix suggestion. Every evaluator in the platform (agent workspace checks, sim
adapters, the eval bridge) returns the same shape::

    {"pass": bool, "checks": [{"id": "<check_id>", "ok": bool, "detail": "..."}], "score": float}

This module turns that opaque shape into something a learner can act on
without reading the check id, by adding ``title_zh`` / ``description_zh`` /
``expectation`` / ``suggestion`` fields — this is what "explainable eval"
means for M3.

Mirrors ``web/src/lib/rubricDisplay.ts`` (frontend static fallback) — keep the
titles in sync when adding a check id on either side. This module is the
authoritative source; the DB is seeded from it (see
``services.shared.seed_domain_v2.seed_rubric_definitions``).

Deliberately dependency-free (no DB, no FastAPI) so it stays trivially unit
testable and importable from any service without pulling in the whole app.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

ExpectationFn = Callable[[dict[str, Any]], str]
FixFn = Callable[[dict[str, Any], str], str]


def _s(v: Any) -> str:
    return "" if v is None else str(v)


def _list(v: Any) -> str:
    if isinstance(v, (list, tuple, set)):
        return "、".join(_s(x) for x in v)
    return _s(v)


@dataclass(frozen=True)
class RubricCheckSpec:
    """Canonical metadata for one evaluator ``check`` id."""

    check_id: str
    title_zh: str
    description_zh: str
    args_schema: dict[str, str] = field(default_factory=dict)
    learner_visible: bool = True
    weight: float = 1.0
    expectation_fn: ExpectationFn | None = None
    fix_fn: FixFn | None = None

    def format_expectation(self, args: dict[str, Any] | None = None) -> str:
        """Human-readable "what must be true to pass" sentence."""
        args = args or {}
        if self.expectation_fn is not None:
            try:
                text = self.expectation_fn(args)
                if text:
                    return text
            except Exception:
                pass
        return self.title_zh

    def suggest_fix(self, args: dict[str, Any] | None = None, actual: str = "") -> str:
        """Concrete next step for the learner when this check fails.

        ``actual`` is the evaluator's raw ``detail`` string (if any); it is
        appended for transparency but the suggestion itself must stand on
        its own without it.
        """
        args = args or {}
        base = ""
        if self.fix_fn is not None:
            try:
                base = self.fix_fn(args, actual) or ""
            except Exception:
                base = ""
        if not base:
            base = f"请检查是否满足：{self.format_expectation(args)}"
        if actual:
            base = f"{base}（当前检测结果：{actual}）"
        return base


def _fmt_path(args: dict[str, Any], default: str = "index.html") -> str:
    return _s(args.get("path") or default)


REGISTRY: dict[str, RubricCheckSpec] = {
    "file_exists": RubricCheckSpec(
        check_id="file_exists",
        title_zh="文件存在",
        description_zh="检查工作区中是否已创建指定路径的文件。",
        args_schema={"path": "文件相对路径"},
        weight=1.0,
        expectation_fn=lambda a: f"需要存在文件：{_fmt_path(a)}",
        fix_fn=lambda a, actual: f"请在工作区根目录创建并保存文件 {_fmt_path(a)}，确认文件名与大小写完全一致。",
    ),
    "text_contains": RubricCheckSpec(
        check_id="text_contains",
        title_zh="文本包含指定内容",
        description_zh="检查文件文本中是否包含指定关键词或片段。",
        args_schema={"path": "文件相对路径", "needle": "需包含的文本片段"},
        weight=1.0,
        expectation_fn=lambda a: f"文件 {_fmt_path(a)} 需包含文本：“{_s(a.get('needle'))}”",
        fix_fn=lambda a, actual: (
            f"请打开 {_fmt_path(a)}，加入包含“{_s(a.get('needle'))}”的内容，保存后重新评测。"
        ),
    ),
    "file_contains": RubricCheckSpec(
        check_id="file_contains",
        title_zh="文件包含指定内容",
        description_zh="检查指定文件的内容中是否包含指定文本片段（与 text_contains 语义一致）。",
        args_schema={"path": "文件相对路径", "needle": "需包含的文本片段"},
        weight=1.0,
        expectation_fn=lambda a: f"文件 {_fmt_path(a)} 需包含文本：“{_s(a.get('needle'))}”",
        fix_fn=lambda a, actual: (
            f"请打开 {_fmt_path(a)}，加入包含“{_s(a.get('needle'))}”的内容，保存后重新评测。"
        ),
    ),
    "dom_contains": RubricCheckSpec(
        check_id="dom_contains",
        title_zh="页面 DOM 包含指定元素",
        description_zh="检查生成的页面中是否存在匹配指定选择器的元素。",
        args_schema={"selector": "CSS 选择器"},
        weight=1.0,
        expectation_fn=lambda a: f"页面 DOM 需包含匹配选择器 {_s(a.get('selector'))} 的元素",
        fix_fn=lambda a, actual: (
            f"请在 HTML 中添加一个能匹配选择器 {_s(a.get('selector'))} 的元素"
            "（例如设置对应的 id / class，或使用对应标签），保存后重新评测。"
        ),
    ),
    "port_listening": RubricCheckSpec(
        check_id="port_listening",
        title_zh="端口正在监听",
        description_zh="检查目标服务是否已在指定端口启动并处于监听状态。",
        args_schema={"port": "端口号"},
        weight=1.0,
        expectation_fn=lambda a: f"需要端口 {_s(a.get('port'))} 处于监听状态",
        fix_fn=lambda a, actual: (
            f"请确认服务已启动并监听端口 {_s(a.get('port'))}；"
            f"可执行相应的启动命令后再评测。"
        ),
    ),
    "command_sequence": RubricCheckSpec(
        check_id="command_sequence",
        title_zh="命令序列执行成功",
        description_zh="检查操作历史中是否按要求依次出现了指定命令/关键字。",
        args_schema={"contains": "需依次出现的命令或关键字列表"},
        weight=1.0,
        expectation_fn=lambda a: f"命令执行记录需依次包含：{_list(a.get('contains'))}",
        fix_fn=lambda a, actual: (
            f"请依次执行：{_list(a.get('contains'))}，并确认每条命令都执行成功后再评测。"
        ),
    ),
    "constraints_satisfied": RubricCheckSpec(
        check_id="constraints_satisfied",
        title_zh="约束条件已满足",
        description_zh="检查方案的非功能指标（成本/延迟/数据合规等）是否满足题目给定的约束。",
        args_schema={},
        weight=1.0,
        expectation_fn=lambda a: "方案需满足题目给定的全部约束条件（成本 / 延迟 / 数据合规等）",
        fix_fn=lambda a, actual: "请对照任务给出的约束条件逐条检查方案参数，修正未满足的项后重新评测。",
    ),
    "decision_note_min_chars": RubricCheckSpec(
        check_id="decision_note_min_chars",
        title_zh="决策说明字数达标",
        description_zh="检查学员填写的决策/权衡说明是否达到最少字数要求。",
        args_schema={"min": "最少字数"},
        weight=1.0,
        expectation_fn=lambda a: f"决策说明需不少于 {_s(a.get('min') or 0)} 字",
        fix_fn=lambda a, actual: (
            f"当前说明字数不足，请补充你的理由与权衡（优缺点、取舍依据），"
            f"达到至少 {_s(a.get('min') or 0)} 字后重新评测。"
        ),
    ),
    "required_components": RubricCheckSpec(
        check_id="required_components",
        title_zh="必需组件已添加",
        description_zh="检查方案/画布中是否包含全部必需的组件节点。",
        args_schema={"includes": "必需组件 id 列表"},
        weight=1.0,
        expectation_fn=lambda a: f"需包含以下组件：{_list(a.get('includes'))}",
        fix_fn=lambda a, actual: f"请补充缺失的组件：{_list(a.get('includes'))}，添加后重新评测。",
    ),
    "resource_exists": RubricCheckSpec(
        check_id="resource_exists",
        title_zh="资源已存在",
        description_zh="检查指定类型和名称的资源是否已创建。",
        args_schema={"kind": "资源类型", "name": "资源名称"},
        weight=1.0,
        expectation_fn=lambda a: f"需存在资源：{_s(a.get('kind'))} · {_s(a.get('name'))}",
        fix_fn=lambda a, actual: f"请先创建 {_s(a.get('kind'))}「{_s(a.get('name'))}」，创建后重新评测。",
    ),
    "resource_ready": RubricCheckSpec(
        check_id="resource_ready",
        title_zh="资源已就绪",
        description_zh="检查指定资源是否已启动/初始化完成，进入可用（ready）状态。",
        args_schema={"kind": "资源类型", "name": "资源名称"},
        weight=1.0,
        expectation_fn=lambda a: f"资源需处于就绪状态：{_s(a.get('kind'))} · {_s(a.get('name'))}",
        fix_fn=lambda a, actual: (
            f"请确认 {_s(a.get('kind'))}「{_s(a.get('name'))}」已完成启动/初始化并进入 ready 状态，"
            "再重新评测。"
        ),
    ),
}


def get_spec(check_id: str) -> RubricCheckSpec | None:
    return REGISTRY.get(check_id or "")


def _fallback_fields(check_id: str) -> dict[str, Any]:
    return {
        "title_zh": check_id or "未知检查项",
        "description_zh": "该检查项暂无中文说明，请联系教研核实规则。",
        "expectation": "",
        "learner_visible": True,
        "weight": 1.0,
    }


def enrich_rubric_item(item: dict[str, Any]) -> dict[str, Any]:
    """Add Chinese display fields to one rubric criterion.

    ``item`` looks like ``{"check": "file_exists", "args": {...}}`` (as used
    in a day package's ``lab.rubric`` and in ``rubric_criteria``). Returns a
    new dict — the original fields (``check``/``args``/etc.) are preserved.
    """
    if not isinstance(item, dict):
        return item
    check_id = _s(item.get("check") or item.get("check_id") or item.get("id"))
    args = item.get("args") or {}
    spec = get_spec(check_id)
    out = dict(item)
    if spec is None:
        for k, v in _fallback_fields(check_id).items():
            out.setdefault(k, v)
        out.setdefault("hint", "")
        return out
    out["title_zh"] = spec.title_zh
    out["description_zh"] = spec.description_zh
    out["expectation"] = spec.format_expectation(args)
    out["hint"] = spec.suggest_fix(args, "")
    out["learner_visible"] = spec.learner_visible
    out.setdefault("weight", spec.weight)
    return out


def enrich_rubric_list(items: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [enrich_rubric_item(it) for it in (items or []) if isinstance(it, dict)]


def attach_rubric_args(result: dict[str, Any], rubric: list[dict[str, Any]] | None) -> dict[str, Any]:
    """Best-effort: zip ``args`` from the original rubric list into each check.

    Evaluator ``checks`` lists are built by iterating the rubric in order, so
    position ``i`` in ``checks`` corresponds to position ``i`` in ``rubric``.
    This lets :func:`enrich_eval_result` produce a check-specific suggestion
    even though the raw evaluator result itself does not carry ``args``.
    Mutates and returns ``result``; no-ops when shapes don't line up.
    """
    if not rubric or not isinstance(result, dict):
        return result
    checks = result.get("checks")
    if not isinstance(checks, list):
        return result
    for i, c in enumerate(checks):
        if not isinstance(c, dict) or c.get("args"):
            continue
        if i < len(rubric) and isinstance(rubric[i], dict):
            c["args"] = rubric[i].get("args") or {}
    return result


def enrich_eval_result(result: dict[str, Any]) -> dict[str, Any]:
    """Add Chinese explainable-eval fields to an evaluator result.

    Input/output shape: ``{"pass": bool, "checks": [...], "score": float, ...}``.
    Each check gains ``title_zh`` / ``description_zh`` / ``expectation`` /
    ``suggestion`` (suggestion is empty when the check already passed). Also
    adds a top-level ``weighted_score`` using each check's registry weight
    (falls back to ``1.0`` for unknown checks). Idempotent and safe to call
    more than once (e.g. once close to the evaluator, once again in the eval
    bridge as a defensive re-enrichment).
    """
    if not isinstance(result, dict):
        return result
    checks = result.get("checks")
    if not isinstance(checks, list):
        return result

    enriched_checks: list[Any] = []
    total_weight = 0.0
    passed_weight = 0.0
    for c in checks:
        if not isinstance(c, dict):
            enriched_checks.append(c)
            continue
        check_id = _s(c.get("id") or c.get("check") or c.get("check_id"))
        args = c.get("args") or {}
        actual = _s(c.get("detail") or c.get("actual") or "")
        ok = bool(c.get("ok"))
        spec = get_spec(check_id)
        nc = dict(c)
        weight = spec.weight if spec is not None else 1.0
        if spec is None:
            for k, v in _fallback_fields(check_id).items():
                nc.setdefault(k, v)
            nc["suggestion"] = "" if ok else "该检查项暂无中文说明，请联系教研核实规则。"
        else:
            nc["title_zh"] = spec.title_zh
            nc["description_zh"] = spec.description_zh
            nc["expectation"] = spec.format_expectation(args)
            nc["suggestion"] = "" if ok else spec.suggest_fix(args, actual)
        total_weight += weight
        if ok:
            passed_weight += weight
        enriched_checks.append(nc)

    out = dict(result)
    out["checks"] = enriched_checks
    if total_weight > 0:
        out["weighted_score"] = round(passed_weight / total_weight, 4)
    return out
