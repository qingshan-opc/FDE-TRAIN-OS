# orchestrator

日任务编排与节点状态机。

## 职责

- `Camp → DayPackage → Nodes` 解锁与推进
- 节点类型：`learn | quiz | lab | project | review | unlock`
- 读取灵知 `knowledge_id[]` / tag，驱动「今日学习」
- 不执行仿真与评测（委托 `sim-router` / `EvalBridge`）

## 建议 API（骨架）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/camps/{camp_id}/days/{day}` | 日任务包 + 节点状态 |
| POST | `/api/v1/nodes/{node_id}/complete` | 标记节点完成（需证据） |
| POST | `/api/v1/days/{day}/unlock` | 解锁次日（闸门通过后） |

## 配置

- `DATABASE_URL` — PostgreSQL
- `LINGZHI_BASE_URL` / `LINGZHI_API_KEY` — 卡片列表（只读）

实现入口：`app.py`（FastAPI stub）。
