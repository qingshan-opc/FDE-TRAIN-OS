# coach-gateway

AI 导师网关：拼装上下文 → 灵知 RAG（citations）+ anyCode `fde-coach` Skill（LEVEL1–3）。

## 职责

1. 调灵知 `rag/ask`（citations 为准）
2. 调 anyCode Workbench + Coach Skill（策略与分层提示）
3. 将 LEVEL / 失败次数写入 progress 证据
4. 可选读 Agent job summary / 仿真摘要（由请求体传入）

## 降级

- anyCode Workbench 不可达 → 返回拼装的灵知/模板答案（`coach_mode=rag_only` 或 `offline`）
- 禁止把学员动作转发到 anyCode bash（coach 使用独立沙箱目录）

## API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/coach/ask` | 同步：`{ help_mode, question, skill_id, max_help_level, … }` |
| POST | `/api/v1/coach/ask/stream` | SSE：`meta` → `delta*` → `done` |

实现入口：`app.py`。共享客户端：`services/shared/anycode_client.py`。
