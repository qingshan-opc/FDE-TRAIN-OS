# Day6 学习向审计（口播 + PPT）

日期：2026-07-29  
范围：第 1–5 节（不含已撤验收节）  
标准：学生能否听懂并完成段末自检；PPT 是否一段一论点、无口播正文泄漏。

## 结论

**可过稿（文稿 + PPT HTML）**。细讲口播已落地；PPT 已按口播 regen；审查指出的口播泄漏 / 四层图命名 / SVG「Day N」已修复。未跑 TTS/渲染。

## 段数与结构

| 节 | 段数 | 结构要点 |
|----|------|----------|
| 1 | 10 | 开场→来历→小模型→泛化→接龙→四层→编排→接入→多模态→自检 |
| 2 | 8 | Token 单位/成本拆开；窗口满了单独成段 |
| 3 | 8 | 坏/好 Prompt 拆开；RAG 故事与五步拆开 |
| 4 | 7 | Eval 为何/怎么拆开 |
| 5 | 8 | Harness 与 Tool 拆开 |

## 已修复问题

| 问题 | 处理 |
|------|------|
| 旧稿一段多结论 | 细讲分段 + 虚拟学生拦路 + 段末自检 |
| PPT slide 与口播 id 不一致 | `sync_section(..., regen_html=True)` |
| `oral_cards` 把口播泄进 PPT | 禁用回退；补显式概念卡 |
| 四层图与口播命名不一致 | `llm-ecosystem.svg` → 应用/编排/模型/基建 |
| SVG 含 Day N | 本地图改为「第五天/第八天」 |
| 讲解图路径带括号 | sync 解析剥离 `（…）` |
| `align.main()` 误覆写 yaml | sync CLI 不再默认调用；审计注明 |

## 学生学习路径自检（抽问）

| 节 | 学生应能回答 |
|----|----------------|
| 1 | 小模型 vs 大模型？编排干什么？你在哪两层？ |
| 2 | Token 是字数吗？窗口满了三条路？幻觉为何是机制？ |
| 3 | 坏/好 Prompt 各一例；RAG 为何像开卷；为何不先微调？ |
| 4 | Eval 三件套；三条降级；为何「挺像」不能发版？ |
| 5 | Harness≠MCP；Workflow vs Agent；Copilot vs Agent 风险差 |

## 过稿后动作

1. 用户确认各节 `PPT_AND_NARRATION.md`
2. TTS → patch → 渲染 → MinIO → day.yaml media（旧 `timing.json` 会随之刷新）
3. **禁止**直接跑 `scripts/align_day06_section_ppt.py` 的 `main()`（硬编码 SECTIONS 会回写旧 yaml）

## 产物路径

- 口播源：`scripts/section_narrations/day06_s01.yaml` … `s05.yaml`
- 过稿：`class/bootcamp/day-06/section-*/PPT_AND_NARRATION.md`
- PPT：`class/bootcamp/day-06/section-*/video/index.html`
- 本审计：`class/quality/day06-learning-audit.md`
