# 提示词 04 · Agent Loop（D8）

> 整份粘贴。前置：Skill 可加载；今日实现 **tool_calls 闭环**。

---

在本仓库实现 `agent/loop.py`（语言可与项目一致）。这就是你自己的 Agent 循环，不依赖外部产品源码。

## Loop 伪代码（必须等价实现）

```
messages = [system, ...history, user]
for turn in 1..max_turns:   # 默认 20
  resp = llm(messages, tools=[file_read, skill, ...])
  append assistant message
  if no tool_calls: return final text
  for each tool_call:
    result = dispatch(tool_call)
    append tool result message
    append line to runs/.../log.jsonl
return "max_turns exceeded" if loop ends
```

## 工具最小集

1. `file_read` — 仅允许项目目录内路径  
2. `skill` — 调用已有 Skill  
3.（可选）`http_get` — 只读访问本机业务 API

禁止无限制 `bash` 删库级命令；若提供 bash，必须 cwd 沙箱 + 超时。

## System prompt

写入 `agent/prompts/agent_loop.md`：说明何时调用工具、如何结束、不要编造工具结果。

## API

`POST /api/agent/turn` 或扩展现有 chat：支持 tools。驾驶舱可仍用旧聊天；CLI/`curl` 能演示 loop 即可（UI 接线在 D10）。

## 验收

- 用户说「根据最新列表生成周报」时，模型会调 `skill` 或 `file_read`，而不是空口编数据  
- `log.jsonl` 可见多 turn  
- `max_turns` 可配置并在超限时停止  

先计划后编码。
