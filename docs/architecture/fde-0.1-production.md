# FDE 0.1 生产拓扑补充

相对首期骨架，0.1 增加：

- JWT 鉴权 + Camp/Enrollment + 一营 Key 代持
- Postgres（可选）/ SQLite(dev) 统一 schema
- AgentGateway：`AGENT_MODE`、配额、产物归档、取消
- EvalBridge 统一评测出口
- 学员 `/app`、教研 `/author`
- `/metrics` + `request_id`
- compose：postgres + minio

联调：灵知与 anyCode 为外挂依赖；`AGENT_MODE=auto` 在 anyCode 不可达时降级 stub。
