# 讲解图信息密度（对标 schedule 四张图）

权威 SVG 在 `class/assets/diagrams/`。PPT 主视觉必须达到同等「可指读」密度，禁止只有标题的空 slide。

## 四类主视觉模板

### 1 · 分层图（LLM 生态 / 四层接电）

对标：`llm-ecosystem.svg`、`four-layer.svg`

| 必含 | 说明 |
|------|------|
| L1–Ln 色块 | 每层独立边框/底色，层号 + 英文标签（MODEL / PLATFORM / …） |
| 侧栏白话 | 左或右竖排：「能力的源头」「你在这里」等 |
| 层内名词 | 每层 **2–4 个具体名**（GPT/Claude、Ollama/vLLM、MCP/Tool Calling、部门驾驶舱） |
| 当前位置 | 一层 `.hot` 或箭头标注「← 你在这里」 |
| 层间箭头 | 上下交互词：点击·输入 / SQL 查询 / Prompt 调用 / 摘要·建议 |

HTML 实现：`.layer-stack` + `.layer-card` + `.layer-side`；或 `.diagram-box img` 嵌 SVG + 旁白 `.tag-row`。

### 2 · 演进网格（十天接电）

对标：`ten-day-grid.svg`

| 必含 | 说明 |
|------|------|
| 行 = 技术层 | 前端 / 接口 / 数据库 / 模型 / Agent（5 行） |
| 列 = 天/版本 | D1…D6 / W2，列头带版本号 V0.1…V1.0 |
| 单元格状态 | 浅色「—/模拟」→ 实色「真数据/已上线/接电中」 |
| 脚注里程碑 | ★ V1.0 上线、★ V2.0 能干活 |

HTML：`.evo-grid` 表格或 CSS grid；`.cell.dim` / `.cell.live` / `.cell.hot`。

### 3 · 决策循环（Agent / Harness）

对标：`agent-loop.svg`、`harness-anatomy.svg`

| 必含 | 说明 |
|------|------|
| 中心盒 | **模型 + Harness（骨架）** + 五词：工具表·记忆·规划·重试·日志 |
| 外围 5 节点 | 理解任务 → 规划 → 调用工具 → 观察结果 → 继续/求助 |
| 顺时针箭头 | 节点间连线，每节点 1 行白话 |

HTML：`.loop-center` + `.loop-node` ×5；或 SVG 嵌入。

### 4 · 流程梯子 / 双卡对比

对标：`day5-dev-process.svg`、瀑布 vs 敏捷

| 必含 | 说明 |
|------|------|
| `.ladder` | 6 站：当前站 `.hot`，已过 `.on` |
| 或 `.vs-grid` | 左瀑布 / 右敏捷，各 2 bullet |
| 或 `.duo`/`.trio` | 每卡：`.lab` + `h4` + `p`，共 2–3 卡 |

## 每段 slide 最低密度

**至少满足以下 4 项中的 3 项：**

1. 眉题 `.sec-label`（节号 + 英文站名）
2. 大标题 `.display`（≤16 字主句）
3. **1 个主视觉**（上表四类之一，或 `.diagram-box` SVG）
4. **2–4 个可指读具体词**（产品名/工具名/阶段名，出现在 tag/card/层内）

❌ 失败样例：只有 `.display` + 一段 `.lede` 长文，无图无卡无 tag。  
❌ 失败样例：主区域 >60% 空白灰底。

## 抽帧 QA（丰度）

除空页检查外，随机 2 帧需满足：

- 可见 ≥1 个**非标题**的具体名词（如 FastAPI、PostgreSQL、MCP）
- 可见 ≥1 个结构化块（色块/卡片/梯子格/表格格）

## 讲解图资产

优先复用 `class/assets/diagrams/*.svg`，复制到 `section-…/video/assets/diagrams/` 或 `../../assets/diagrams/` 相对引用。

| 主题 | SVG |
|------|-----|
| 五阶段 | 新建 `enterprise-digital-stages.svg`（五阶竖梯） |
| 生态 | `llm-ecosystem.svg` |
| 四层 | `four-layer.svg` |
| 十天 | `ten-day-grid.svg` |
| Agent | `agent-loop.svg` |
| 部署 | `deploy-pipeline.svg` |
| 后端地图 | `day5-backend-map.svg`（改文案后） |
| 前端地图 | `day5-frontend-map.svg` |

新 SVG 风格：浅底、ink 线、accent 强调，与 schedule 讲解图一致。
