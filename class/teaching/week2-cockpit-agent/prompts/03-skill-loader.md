# 提示词 03 · Skill 加载与调用（总览）

> 若分节上课，请分别用：
> - 第 4 节：[`03a-define-skill-md.md`](03a-define-skill-md.md)（只写说明书）
> - 第 5 节：[`03b-skill-run-evidence.md`](03b-skill-run-evidence.md)（加载 · 运行 · 证据）
>
> 下面是「一次做完」的合并版，仅在赶进度时整份粘贴。

---

请在本仓库实现 **Skill 最小内核**（用 Python / Node 均可，跟你现有后端一致即可）。

## 你要做成什么

Skill = 一份可加载的说明书 + 一次可执行、可留证的运行。  
学员仓库里自给自足。

## 要求

1. 目录 `skills/<id>/SKILL.md`：
   - YAML frontmatter：`name`、`description`
   - 正文：输入 / 步骤 / 输出 / 验收（四部件）
2. 实现扫描器：启动时或首次调用时加载全部 Skill，把「Available skills」注入给模型（或单独列表 API）。
3. 实现工具 `skill`：参数 `name` + `input`；执行时读取对应 `SKILL.md`；结果写入 `runs/<date>-<name>/`。
4. 至少 1 个真实业务 Skill；必须读自己的业务数据。
5. 提供 CLI 或 API：`POST /api/agent/skill/run`。

## 验收

- `skills/` 下 ≥1 个合格 `SKILL.md`
- 跑通一次，`runs/` 含 `input.md` `output.md` `verdict.md`
- 写清如何新增第二个 Skill

先列计划，等「确认」再改。
