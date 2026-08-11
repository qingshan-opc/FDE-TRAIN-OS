# 提示词 06 · 驾驶舱 UI 接线 Agent 事件流（D10）

> 整份粘贴。前置：chat / loop / task_runner 后端已通。

---

把 Agent 运行时接到驾驶舱助手位，完成 **V2.0 可答辩演示**。

## UI 要求

1. 助手位支持：普通多轮聊天 + 「执行任务」入口（或把长句自动当 goal）。  
2. 运行中展示事件（轮询或 SSE 均可）：
   - `turn_start`
   - `tool_call`（工具名 + 摘要）
   - `tool_result`（截断）
   - `confirm_required`（弹出批准/拒绝）
   - `turn_done` / `task_done`
3. 确认闸在 UI 上可点；拒绝后界面有明确状态。  
4. 历史：至少显示本会话消息；可链到 `runs/` 目录说明。

## 不要做

- 不要重写业务 CRUD  
- 不要引入重型前端框架（若现有是原生 HTML，保持原生 + 少量 JS）

## 答辩演示脚本（写入 `docs/defense-demo.md`）

1. 打开驾驶舱，指三个指标  
2. 聊天问一个只读问题  
3. 发起一个会调 Skill 的任务  
4. 演示一次确认闸  
5. 打开 `runs/` 指给评委看  

## 验收

对照 `class/teaching/week2-cockpit-agent/acceptance/checklist.md` 的 D10 / V2.0 段全部勾上。

先计划后编码。
