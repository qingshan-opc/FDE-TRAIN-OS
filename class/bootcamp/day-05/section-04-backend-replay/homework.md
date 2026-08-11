# 第 4 节 · 提交与验证

## 提交文件

- `day5-replay/iteration-api-spec.md`
- `day5-replay/iteration-db-change.md`
- 本次后端代码改动
- `day5-replay/backend-acceptance.md`
- `day5-replay/backend-handoff.md`

## 通过条件

- 产品规则与请求合同一致；
- 数据是否变化有明确结论；
- 原有接口保持兼容；
- 启动、健康、成功、错误和持久化有真实结果；
- 前端真实调用完成联调；
- 测试能从后端交接找到入口和已知限制。

## 不通过时回到哪里

- 业务规则冲突：退回 `@产品经理`；
- 请求字段不一致：回到 `@前端` 与 `@后端` 对合同；
- 实现或数据问题：留在 `@后端` 修复并重新自检。
