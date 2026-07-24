# FDE Learning OS · 愿景闭环（对齐 721）

## 已落地

| 能力 | 状态 | 入口 |
|------|------|------|
| Day1–12 课纲包（6 胶囊/日） | ✅ | `contracts/examples/day-*-curriculum.yaml` |
| 学员台可学习 UI | ✅ | `/app/` |
| Agent Lab + Sim Lab（Day5/7） | ✅ | agent SSE / sim sessions |
| Auth / Eval / Passport | ✅ | `:8760` |

## 验证

```bash
./scripts/start.sh
./scripts/smoke_camp12.sh
```

演示：http://127.0.0.1:8760/app/ · `demo@fde.local` / `demo1234`

## 下一棒（非本里程碑）

灵知 live ingest、真实 Docker/K8s、导师台、支付/微信登录。
