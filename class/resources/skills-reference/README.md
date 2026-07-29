# 课程设计 Skill 参考库（第三方提取版，仅作教研参考）

> 用途：第一周课程（AI 时代的产品经理 / 架构师 / 前端 / 后端 / FDE 全栈理论）的
> 课件生产参考——动态 PPT 大纲、文案写作、文档生成的工作流范式。
> **不进入学员端运行时，不被任何服务加载。** 经课程负责人点名批准下载（2026-07-25）。

## 目录

- `kimi-agent-internals/` — 提取自 Kimi OK-Computer 的 skill 源码与 agent 系统提示词
  - `skills/`：docx / pdf / webapp-building / xlsx 的 SKILL.md + 脚本
  - `agent-prompts/`：slides.md（动态 PPT 生成主提示词）、docs.md（文案/文档）、
    websites.md、sheets.md、ok-computer.md、base-chat.md
  - 上游：https://github.com/dnnyngyen/kimi-agent-internals （CC0 + CC BY 4.0，提取内容归 Moonshot AI 所有）
- `kimi-doc-skills/` — Kimi 办公三件套提取版（docx / pdf / xlsx），含校验流水线与 OpenXML 最佳实践
  - 上游：https://github.com/thvroyal/kimi-skills
  - 已剔除预编译二进制（Validator.dll / KimiXlsx 运行时，约 73MB），仅保留文档与脚本。

## 对课程生产的借鉴点

1. **动态 PPT**：`agent-prompts/slides.md` 的「大纲先行 → 逐页 HTML → 校验」流水线，
   对应本课程 Day 2/Day 5 讲解图与动态课件的设计方式。
2. **文案写作**：`agent-prompts/docs.md` 的结构化长文档规范，用于公开课/讲义文风基准。
3. **交付校验**：docx/xlsx skill 的「生成后自动校验（validate_*.py）」思想，
   与 FDE 训练营「生成 → 验收 → 迭代」闭环同构——可直接引用为教学案例。
