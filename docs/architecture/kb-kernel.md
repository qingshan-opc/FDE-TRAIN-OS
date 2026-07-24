# KbKernel

FDE 内容内核：封装灵知 Open API，对外暴露稳定 FDE 路径。

## API

| Method | Path | 上游 |
|--------|------|------|
| GET | `/api/v1/kb/knowledge?q=&tag=&limit=&camp_id=` | `GET /api/v2/open/knowledge` |
| POST | `/api/v1/kb/ask` | `POST /api/v2/open/rag/ask` |
| POST | `/api/v1/kb/ask/stream` | `POST /api/v2/open/rag/ask/stream` |
| POST | `/api/v1/kb/memories` | `POST /api/v2/open/memories` |
| GET | `/health` | 本地 |

## 鉴权

- 浏览器 → FDE session（首期可用 `X-Learner-Id` 演示头）
- FDE → 灵知：`X-API-Key`（按 `camp_id` 解析）

Key 解析顺序：

1. `LINGZHI_CAMP_KEYS` 中 `camp_id:key`
2. `LINGZHI_API_KEY` 全局兜底

## 降级

灵知不可达时：`ask` 返回 `mode=offline`，附带日任务 YAML `learn.steps` 文本（若请求带 `fallback_steps`）。

## 红线

- 禁止把 Key 下发到浏览器
- 一营一 Key / 一机构一 workspace
