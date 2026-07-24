# progress

证据链、能力标签、认证号（Passport）。

## 职责

- 持久化节点完成证据（仿真 artifacts、Coach LEVEL、测验结果）
- 聚合能力标签 → 认证号
- 供导师台与结业档案读取

## 建议 API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/evidence` | 写入一条证据 |
| GET | `/api/v1/learners/{id}/passport` | 能力档案摘要 |
| GET | `/api/v1/learners/{id}/evidence` | 证据列表 |

实现入口：`app.py`。
