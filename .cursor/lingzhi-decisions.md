## 灵芝防回归记忆（自动注入）

以下为本企业知识库中已沉淀的**已采纳决策**与**被否决方案**。
编码时必须遵守；**禁止回退到 anti-pattern 中列出的旧方案**。
工作区提示: `digital-fde-platform`

### 已采纳决策 (tag=decision)
- **决策记忆 digital-fde-platform 2026-07-24**: 该文档记录了2026年7月24日对`digital-fde-platform`工作区首页的重做决策。原首页因居中堆叠、衬线标题换行松垮及粒子效果廉价而显得“不够高级”。新方案采用左对齐非对称布局，以论点式主标语和毛玻璃数据条（如“21天任务驱动”）替代模板化设计，并优化了按钮反馈与移动端响应式。改动已通过提交`ac93d33`和`c5be906`合并至main分支，并部署在本地服务器供审查。
- **决策记忆 digital-fde-platform 2026-07-23**: 该文档记录了2026年7月23日对`digital-fde-platform`工作区个人中心页面的布局重构决策。原移动端“窄栏+卡片堆叠”样式被改为电脑端左侧菜单（240px）加右侧内容区（padding 48px）的布局，并新增了`LearnerAccountLayout`组件供三页共用。`Profile.tsx`被重构为桌面两栏结构，左侧显示基本资料，右侧显示认证与证书摘要，同时`Identity.tsx`和`Certificates.tsx`也接入了同一布局并去除了底部
- **决策记忆 digital-fde-platform 2026-07-22**: 该文档记录了2026年7月22日对`digital-fde-platform`工作区进行的浏览器点击测试报告。测试使用Cursor内置浏览器在`http://127.0.0.1:8760`进行真实点击，并交叉运行Playwright E2E作为对照。测试结果显示，功能主链路（登录、选课、TaskHome、深链、学习页）在浏览器点击测试中均通过，但Playwright有3条用例因选择器问题失败。报告还指出了新学员待办数量显示不准确和UI退出登录跳转延迟等小问题。最终结论是功能可
- **决策记忆 game-test 2026-07-24**: 该文档记录了2026年7月24日对游戏测试工作区中“金蝉捕捉器”HTML文件的重构决策。主要修复了三个问题：限制金蝉飞行高度在0.6至3.5米范围内、新增占20%刷新权重的幼蝉种类、以及实现基于Web Audio PannerNode和HRTF的空间音频定位功能。重构后的单文件大小为572KB，零外链且离线可玩，所有蝉种均可捕捉。建议佩戴耳机体验蝉鸣从树上或草丛真实方位传来的空间音频效果。
- **决策记忆 anycode 2026-07-24**: # 决策记忆 anycode 2026-07-24  _session_id: `f3fabea2-925f-412d-bb7b-1954001ffe9c`_ ## 问题 / 背景 工作区: `anycode` session_id: `f3fabea2-925f-412d-bb7b-1954001ffe9c`  ## 试过什么 / 最终采用 / 效果  已修好。根因是 Codex App / CLI 进程里没有 `KIMI_API_KEY`；`shell_environme
- **决策记忆 digital-lingzhi-platform 2026-07-23**: # 决策记忆 digital-lingzhi-platform 2026-07-23  _session_id: `45d26a27-154e-41e1-8ae9-7d06eaf744e1`_ ## 问题 / 背景 工作区: `digital-lingzhi-platform` session_id: `45d26a27-154e-41e1-8ae9-7d06eaf744e1`  ## 试过什么 / 最终采用 / 效果  **灵知知识库 · 企业 AI 转型第一站**  企业
- **决策记忆 digital-ai-wechat 2026-07-22**: 该文档记录了2026年7月22日关于`digital-ai-wechat`工作区的一次决策。决策内容为关闭PadPro容器（包含MySQL和Redis服务）以及采集进程，导致端口`:8059`无法访问。该记录由Cursor stop hook自动沉淀生成，并标记为决策记忆。
- **决策记忆 818cloud 2026-07-18**: 该文档记录了2026年7月18日关于“818cloud”工作区的一项技术决策，核心是确定“灵知”系统的技术栈。系统采用Tauri实现零录入采集，通过SHA-256、SimHash和Embedding进行多层去重，并使用MinIO和Worker进行异步入库。文档切片采用标题感知分块，默认约1500字，并支持L0原文、L1摘要和L2知识卡片三个层级。检索方面，系统结合PostgreSQL全文搜索与Qdrant向量检索（bge-m3模型），通过RRF混合融合和bge-reranke
- **决策记忆 litu-miniapp 2026-07-18**: 该文档记录了2026年7月18日关于`litu-miniapp`工作区的一个决策：用户无法提交App审核，因为草稿中只添加了“App 内购买项目”，缺少“App 版本”。文档提供了两种解决方案：一是在右侧“草稿提交”面板中添加iOS 1.1版本；二是关闭草稿面板，直接从1.1版本页点击“添加以供审核”，将内购与版本一同提交。文档还列出了提交前需检查的关键项，如构建版本、截屏、描述等。最终建议用户尝试从版本页直接提交，若按钮仍灰色则需进一步排查。
- **决策记忆 digital-lingzhi-platform 2026-07-17**: 该文档记录了2026年7月17日关于“digital-lingzhi-platform”工作区中“栖云府16幢1102”装修水电阶段的工地全景评估。评估指出，管线分色清晰、墙面竖向开槽、水管固定及打压测试等工艺基本合理。但存在地面电管交叉叠压、材料压在管路上、强弱电间距不清、全景未命名等主要问题。建议在回填前重点检查水路打压记录、电路测试、强弱电隔离及地面管线保护。总体而言，工艺框架合理，但地面布管和现场管理细节需改进。
- **决策记忆 digital-lingzhi-platform 2026-07-17**: 根据2026年7月17日的决策记录，工作区`digital-lingzhi-platform`已确定按**锁定汇率6.8**重算美元报价，并保留一期**15%应急**费用。换算公式为`美元 = ROUND(人民币 ÷ 6.8)`，且假设A11已明确锁定汇率不随市场浮动。主报对比显示，采用新汇率后，P1小计从$49,399升至$52,668，P1加15%应急后约$60,568，P2升至$191,049，P3升至$226,871，三期合计（含P1应急）为**$478,488**。
- **决策: nginx Host 用 http_host**: 根据决策文档，问题背景是skill bundle的base_url丢失了非标准端口:8231。尝试过仅使用\$host变量但未能解决。最终采用nginx的\$http_host变量配合X-Forwarded-Port头。这样生成的LINGZHI_BASE_URL会包含端口号，使脚本能够正常通信。后续应避免仅使用\$host，以免丢失非标准端口信息。

### 避坑清单 (tag=anti-pattern)
- **避坑: Ant Tabs 不要全局 display:flex**: # 避坑: Ant Tabs 不要全局 display:flex ## 问题 Dedup/Integrations tab 无法点击 ## 最终采用 只对 .ant-tabs-tabpane-active 设 display:flex ## 不要再做 不要对所有 .ant-tabs-tabpane 强制 display:flex（会盖掉 display:none）

若本轮确认了新的最终方案或明确否决了某方案，会话结束时会由 stop hook 自动回写记忆；也可主动调用 `./scripts/upload_memory.sh`。
