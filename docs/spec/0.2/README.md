# FDE Learning OS 0.2 Spec

> 状态：可评审 · 对齐可用演示 `/app`  
> 依赖：0.1 内核（JWT / PG / AgentGateway / Orchestrator）

## 1. 目标

把 0.1「能跑的内核」提升为 **可给人验收的学员日任务工作台**：

- 打开即可用，不强制灵知 online
- Day1–Day2 主路径可走通：学习 → 测验 → Agent Lab → 证据 → Passport
- Spec 可评审：信息架构、Day YAML、稳定 API、验收清单齐全

## 2. 与 0.1 的关系

| 层 | 0.1 | 0.2 |
|----|-----|-----|
| 鉴权 / 营期 / PG / Agent | 已有 | 复用 |
| 学员 UI | 可用骨架 | **按 Spec 可演示级** |
| 文档 | 架构 / 发布清单 | **产品+API Spec 包** |
| 内容 | Day1/2 YAML | 规范冻结 + 演示对齐 |

## 3. 范围内

- 学员工作台 `/app`（登录、日切换、节点门禁 UI、Lab/Coach/Passport）
- Day Package YAML 规范
- 稳定 API 面清单
- 手工 + 脚本验收

## 4. 非目标（本轮不做）

- 支付 / 微信登录 / 每学员 Docker
- 完整 11 天课件入库
- 强制灵知 live（offline steps 兜底即可）
- Next.js 重写

## 5. 验收标准（摘要）

见 [acceptance.md](./acceptance.md)。最低：

1. `demo@fde.local` 登录成功  
2. Day1：learn → quiz → lab(agent) → 预览 → passport  
3. Day2：至少 learn → quiz → lab 最短路径  
4. `scripts/smoke_0.2.sh` 通过  

## 6. 文档索引

| 文档 | 说明 |
|------|------|
| [learner-workbench.md](./learner-workbench.md) | 学员台 IA / 状态 / 空态 |
| [day-package.md](./day-package.md) | Day YAML 规范 |
| [api-surface.md](./api-surface.md) | 稳定 API |
| [acceptance.md](./acceptance.md) | 验收清单 |

## 7. 演示入口

- 学员台：http://127.0.0.1:8760/app/  
- 账号：`demo@fde.local` / `demo1234`  
- 教研台：http://127.0.0.1:8760/author/  
