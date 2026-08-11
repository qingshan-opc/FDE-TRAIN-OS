# 提示词 03b · Skill 加载 · 运行 · 证据（D7 · 第 5 节）

> 整份粘贴。前置：上一节已定稿 `skills/<id>/SKILL.md`。  
> 本节 **不要重写说明书**；专注扫描器、调用与 runs/ 证据。

---

请在本仓库实现 **Skill 加载与运行最小内核**（Python / Node 与现有后端一致即可）。

## 前置检查

先确认已有 ≥1 个合格 `skills/<id>/SKILL.md`。若缺失，先停下来告诉我，不要擅自重写一整份说明书。

## 要求

1. **扫描器**：启动时或首次调用时加载全部 `skills/*/SKILL.md`，产出「Available skills」列表（可注入 system，或提供列表 API）。
2. **调用入口**（二选一或都做）：
   - 工具 / 函数 `skill(name, input)`
   - HTTP：`POST /api/agent/skill/run`（body：`name` + `input`）
3. **执行**：读取对应 `SKILL.md`，按说明书对真实业务输入跑通一次（可让 LLM 按说明书产出，或跑可选脚本）。
4. **证据目录**（必须真实写入）：

```text
runs/<YYYYMMDD>-<skill>/
  input.md
  output.md
  verdict.md
```

`verdict.md` 对照验收标准逐条 ✓/✗；失败也要诚实记录原因。

5. `docs/` 或 README 加一小节：如何新增第二个 Skill（复制目录 → 改 frontmatter → 重启扫描）。

## 验收

- 能列出 Available skills（含上一节那个）
- 至少成功 run 1 次，`runs/` 三件套齐全
- 对话或 CLI 能触发「请运行某某 Skill」（可先做显式命令，不必完整 Agent Loop）

先列计划，等「确认」再改代码。若上一节提示词会话还在，也可回复「继续完成加载与 run」，但改动范围仍以本节为准。
