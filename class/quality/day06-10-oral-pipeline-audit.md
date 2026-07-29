# Day6–10 口播细讲管线审计

日期：2026-07-29

## 结论

**机械抽检通过**。Day6 已口语化；Day7–10 课表节已细讲重写并 regen PPT；验收节未入库表；未跑 TTS。

## 处理逻辑（与 Day6 一致）

1. yaml 细讲分段（一段一事 + 虚拟学生 + 仪式句）
2. sync → narration txt + PPT_AND_NARRATION.md
3. regen_html（显式 ppt 卡，禁 oral_cards）
4. 学习向抽检：id 对齐 / 无口播泄漏 / 无 Day N

## 段数（课表节）

| Day | 节数 | 段数合计 |
|-----|------|----------|
| 6 | 5 | 41 |
| 7 | 5 | 40 |
| 8 | 4 | 28 |
| 9 | 4 | 30 |
| 10 | 5 | 42 |

## 守卫修复

- 上屏 SVG `Day N` → `第 N 天`（harness-anatomy / five-blocks / three-states 等）
- Day10 `06-method` → `06-roadmap`
- 跳过 accept：day6 s06 / day7 s06 / day8 s05 / day9 s05

## 过稿后

确认各节 `PPT_AND_NARRATION.md` → TTS → patch → 渲染 → MinIO。
