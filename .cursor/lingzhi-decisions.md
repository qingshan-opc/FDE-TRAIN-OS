## 灵芝防回归记忆（自动注入）

以下为本企业知识库中已沉淀的**已采纳决策**与**被否决方案**。
编码时必须遵守；**禁止回退到 anti-pattern 中列出的旧方案**。
工作区提示: `digital-fde-platform`

### 已采纳决策 (tag=decision)
- **决策记忆 digital-fde-platform 2026-07-22**: 本次决策完成了 `digital-fde-platform` 工作区中任务首页（M0–M2）和后端优化（P1）的全部开发工作，并通过了构建与端到端验证。核心改动包括：统一了CTA/深链跳转逻辑，新增了 `TaskHome.tsx` 任务作战台UI组件，并增加了对应的单元测试和E2E测试。后端方面，优化了 `list_days` 接口的鉴权与查询性能，通过YAML缓存和批量查询消除了N+1问题。验证方式为启动本地服务后检查中栏任务展示、URL跳转参数及右栏按钮功能。
- **决策记忆 digital-fde-platform 2026-07-22**: 本次决策记录了 digital-fde-platform 工作区在 2026 年 7 月 22 日的验收结果。核心结论是，针对“嵌入式 IDE 缺口补齐计划”的 7 项待办事项已全部落地，并通过了单元测试、构建和 Playwright 等所有门禁检查。文档同时指出了 5 个未完全符合计划字面的细节问题，例如资源管理器 CRUD 未完全使用 Dialog、E2E 测试覆盖不全等，但确认这些不影响主路径的可用性。最终认为该计划可以视为完成，可用于演示和回归，并建议可再花半天时间完
- **决策记忆 digital-fde-platform 2026-07-22**: 本次决策记录于2026年7月22日，针对`digital-fde-platform`工作区，主要完成了缺口补齐工作。核心改动包括：`GET /course-versions`接口支持`course_id`参数，版本页根据URL筛选；SiteHome Hero弹窗改为仅含“关闭”按钮，选择文件即上传；课纲弹窗中Day和Capsule的编辑功能接入`YamlImportModal`，校验接口返回`packages`。媒体引用从`LIKE`查询改为jsonb精确匹配，并补充了med
- **决策记忆 anycode 2026-07-22**: 该文档记录了2026年7月22日关于`anycode`工作区的决策记忆。当前Agent执行质量评测（四臂/CompletionGuard）尚未产生真实模型运行结果，现有文件均为合成分数或dry-run清单，不能作为晋级证据。旧版真实实验结果（v3系列）已被降级为smoke测试，不适用于当前闭环评估。要获得真实2×2评测结果，需先启动Dashboard服务，再运行`run-agent-quality.py`脚本进行真实dev消融实验。文档建议如需可立即启动服务并执行真实评测。
- **决策记忆 818cloud 2026-07-18**: 该文档记录了2026年7月18日关于“818cloud”工作区的一项技术决策，核心是确定“灵知”系统的技术栈。系统采用Tauri实现零录入采集，通过SHA-256、SimHash和Embedding进行多层去重，并使用MinIO和Worker进行异步入库。文档切片采用标题感知分块，默认约1500字，并支持L0原文、L1摘要和L2知识卡片三个层级。检索方面，系统结合PostgreSQL全文搜索与Qdrant向量检索（bge-m3模型），通过RRF混合融合和bge-reranke
- **决策记忆 litu-miniapp 2026-07-18**: 该文档记录了2026年7月18日关于`litu-miniapp`工作区的一个决策：用户无法提交App审核，因为草稿中只添加了“App 内购买项目”，缺少“App 版本”。文档提供了两种解决方案：一是在右侧“草稿提交”面板中添加iOS 1.1版本；二是关闭草稿面板，直接从1.1版本页点击“添加以供审核”，将内购与版本一同提交。文档还列出了提交前需检查的关键项，如构建版本、截屏、描述等。最终建议用户尝试从版本页直接提交，若按钮仍灰色则需进一步排查。
- **决策记忆 digital-lingzhi-platform 2026-07-17**: 该文档记录了2026年7月17日关于“digital-lingzhi-platform”工作区中“栖云府16幢1102”装修水电阶段的工地全景评估。评估指出，管线分色清晰、墙面竖向开槽、水管固定及打压测试等工艺基本合理。但存在地面电管交叉叠压、材料压在管路上、强弱电间距不清、全景未命名等主要问题。建议在回填前重点检查水路打压记录、电路测试、强弱电隔离及地面管线保护。总体而言，工艺框架合理，但地面布管和现场管理细节需改进。
- **决策记忆 digital-lingzhi-platform 2026-07-17**: 根据2026年7月17日的决策记录，工作区`digital-lingzhi-platform`已确定按**锁定汇率6.8**重算美元报价，并保留一期**15%应急**费用。换算公式为`美元 = ROUND(人民币 ÷ 6.8)`，且假设A11已明确锁定汇率不随市场浮动。主报对比显示，采用新汇率后，P1小计从$49,399升至$52,668，P1加15%应急后约$60,568，P2升至$191,049，P3升至$226,871，三期合计（含P1应急）为**$478,488**。
- **决策: nginx Host 用 http_host**: 根据决策文档，问题背景是skill bundle的base_url丢失了非标准端口:8231。尝试过仅使用\$host变量但未能解决。最终采用nginx的\$http_host变量配合X-Forwarded-Port头。这样生成的LINGZHI_BASE_URL会包含端口号，使脚本能够正常通信。后续应避免仅使用\$host，以免丢失非标准端口信息。

### 避坑清单 (tag=anti-pattern)
- **避坑: Ant Tabs 不要全局 display:flex**: # 避坑: Ant Tabs 不要全局 display:flex ## 问题 Dedup/Integrations tab 无法点击 ## 最终采用 只对 .ant-tabs-tabpane-active 设 display:flex ## 不要再做 不要对所有 .ant-tabs-tabpane 强制 display:flex（会盖掉 display:none）

若本轮确认了新的最终方案或明确否决了某方案，会话结束时会由 stop hook 自动回写记忆；也可主动调用 `./scripts/upload_memory.sh`。
