# 学员仓库目录约定

在 **Week1 项目根目录** 内落地（不要新开无关仓库）：

```text
<your-week1-project>/
  frontend/                 # 或 cockpit/：驾驶舱页面
  backend/                  # Week1 API + SQLite（沿用）
  agent/
    loop.py                 # 对话 turn loop
    task_runner.py          # 长任务 goal loop
    tools.py                # file_read / bash(受限) / skill
    llm_client.py           # DeepSeek（或兼容 OpenAI 协议）
    prompts/
      agent_loop.md         # 系统提示：何时调工具、如何结束
    config.example.env      # DEEPSEEK_API_KEY=...
  skills/
    <skill-id>/
      SKILL.md              # name / description + 正文步骤
  runs/
    <YYYYMMDD>-<skill-or-goal>/
      input.md
      output.md
      log.jsonl             # 每 turn / tool 一行
      verdict.md
  docs/
    cockpit-brief.md        # 业务字段 → 看板指标映射
```

## 命名纪律

- `skills/` 下每个目录一个 Skill；`SKILL.md` 顶部 YAML frontmatter 必有 `name`、`description`。
- 每次真实跑通写入 `runs/`，答辩只认有 log 的证据。
- 驾驶舱与 Agent **同仓同启**：前端调本地 `/api/agent/...`（或等价接口）。
