## 灵芝防回归记忆（自动注入）

以下为本企业知识库中已沉淀的**已采纳决策**与**被否决方案**。
编码时必须遵守；**禁止回退到 anti-pattern 中列出的旧方案**。
工作区提示: `digital-fde-platform`

### 已采纳决策 (tag=decision)
- **决策记忆 digital-fde-platform 2026-07-28**: 该文档记录了2026年7月28日对“digital-fde-platform”工作区中课程口播的决策与改进过程。上一版口播并非来自真实课堂，而是从论文摘要蒸馏得出，存在信息密度过高、缺少真实互动特征等问题。本次通过下载窦桂梅《丑小鸭》课堂实录，使用Whisper进行ASR识别，提取了真实课堂中的仪式、问链、互动和慢节奏等特征。基于此，第七天口播取消了4分钟上限，每节约2400字，并加入了虚拟学生问答，已清理旧版文件。文档要求先确认S01的汇总稿，再启动全流程渲染，并建议后续可
- **决策记忆 digital-fde-platform 2026-07-28**: 该文档记录了2026年7月28日关于`digital-fde-platform`工作区中弹窗居中问题的修复决策。问题在于弹窗未能在视口正中显示，最终采用三种方案解决：将弹窗挂载到`document.body`、使用`top/left: 50%`加`transform: translate(-50%, -50%)`实现居中，并添加半透明遮罩层和轻微模糊效果。修复后，刷新链上详情页并点击「证书核验」即可看到居中弹窗。该决策由Cursor自动沉淀，标记为决策记忆。
- **决策记忆 digital-fde-platform 2026-07-27**: 该文档记录了2026年7月27日关于`digital-fde-platform`工作区中macOS系统数据占用问题的决策。经实测，约701GB的“系统数据”并非真正的系统文件，而是由Docker Desktop（162GB）、Chrome代码签名克隆（124GB）、Cursor状态库（67GB）等开发工具残留文件构成。文档提供了安全清理优先级，建议优先清理Chrome克隆（约124GB）和Docker构建缓存（可回收约200GB+），并警告Cursor清理会丢失本地聊天索引。
- **决策记忆 digital-fde-platform 2026-07-26**: # 决策记忆 digital-fde-platform 2026-07-26  _session_id: `aa518757-17ba-4827-8161-d54094af52a7`_ ## 问题 / 背景 工作区: `digital-fde-platform` session_id: `aa518757-17ba-4827-8161-d54094af52a7`  ## 试过什么 / 最终采用 / 效果  已整理进 `class/bootcamp/day-05/section
- **决策记忆 digital-fde-platform 2026-07-24**: 该文档记录了在`digital-fde-platform`工作区中，为解决终端命令问题而做出的决策。用户通过设置别名`kimi`来启动K3后端的Claude Code，该命令指向Kimi K3模型（订阅版，1M上下文）。而原有的`claude`命令则指向阿里云qwen3.8模型，其配额在指定时间后才恢复。使用`kimi`命令前需确保在新终端中执行`source ~/.zshrc`，或先运行该命令以避免提示找不到命令。进入后可通过`/status`确认base URL和模型信息
- **决策记忆 digital-fde-platform 2026-07-23**: 该文档记录了2026年7月23日对`digital-fde-platform`工作区个人中心页面的布局重构决策。原移动端“窄栏+卡片堆叠”样式被改为电脑端左侧菜单（240px）加右侧内容区（padding 48px）的布局，并新增了`LearnerAccountLayout`组件供三页共用。`Profile.tsx`被重构为桌面两栏结构，左侧显示基本资料，右侧显示认证与证书摘要，同时`Identity.tsx`和`Certificates.tsx`也接入了同一布局并去除了底部
- **决策记忆 digital-fde-platform 2026-07-22**: 该文档记录了2026年7月22日对`digital-fde-platform`工作区进行的浏览器点击测试报告。测试使用Cursor内置浏览器在`http://127.0.0.1:8760`进行真实点击，并交叉运行Playwright E2E作为对照。测试结果显示，功能主链路（登录、选课、TaskHome、深链、学习页）在浏览器点击测试中均通过，但Playwright有3条用例因选择器问题失败。报告还指出了新学员待办数量显示不准确和UI退出登录跳转延迟等小问题。最终结论是功能可
- **决策记忆 anycode 2026-07-28**: 本次决策为 anycode 工作区新增了「交接同事」功能，在会话和项目的右键菜单中均添加了该选项。用户点击后进入发现同事页面，选中同事后自动弹出预填好的交接向导，并发送交接请求。该功能依赖局域网协作设置，需在同一 Wi‑Fi 下且开启发现才能使用。涉及文件包括会话列表、项目列表、同事页面及交接向导等组件。验证方式为重启应用后右键项目或会话，检查菜单项及交接流程是否正常。
- **决策记忆 digital-lingzhi-platform 2026-07-23**: # 决策记忆 digital-lingzhi-platform 2026-07-23  _session_id: `45d26a27-154e-41e1-8ae9-7d06eaf744e1`_ ## 问题 / 背景 工作区: `digital-lingzhi-platform` session_id: `45d26a27-154e-41e1-8ae9-7d06eaf744e1`  ## 试过什么 / 最终采用 / 效果  **灵知知识库 · 企业 AI 转型第一站**  企业
- **决策记忆 digital-ai-wechat 2026-07-22**: 该文档记录了2026年7月22日关于`digital-ai-wechat`工作区的一次决策。决策内容为关闭PadPro容器（包含MySQL和Redis服务）以及采集进程，导致端口`:8059`无法访问。该记录由Cursor stop hook自动沉淀生成，并标记为决策记忆。
- **决策记忆 818cloud 2026-07-18**: 该文档记录了2026年7月18日关于“818cloud”工作区的一项技术决策，核心是确定“灵知”系统的技术栈。系统采用Tauri实现零录入采集，通过SHA-256、SimHash和Embedding进行多层去重，并使用MinIO和Worker进行异步入库。文档切片采用标题感知分块，默认约1500字，并支持L0原文、L1摘要和L2知识卡片三个层级。检索方面，系统结合PostgreSQL全文搜索与Qdrant向量检索（bge-m3模型），通过RRF混合融合和bge-reranke
- **决策记忆 litu-miniapp 2026-07-18**: 该文档记录了2026年7月18日关于`litu-miniapp`工作区的一个决策：用户无法提交App审核，因为草稿中只添加了“App 内购买项目”，缺少“App 版本”。文档提供了两种解决方案：一是在右侧“草稿提交”面板中添加iOS 1.1版本；二是关闭草稿面板，直接从1.1版本页点击“添加以供审核”，将内购与版本一同提交。文档还列出了提交前需检查的关键项，如构建版本、截屏、描述等。最终建议用户尝试从版本页直接提交，若按钮仍灰色则需进一步排查。

### 避坑清单 (tag=anti-pattern)
- **避坑: Ant Tabs 不要全局 display:flex**: # 避坑: Ant Tabs 不要全局 display:flex ## 问题 Dedup/Integrations tab 无法点击 ## 最终采用 只对 .ant-tabs-tabpane-active 设 display:flex ## 不要再做 不要对所有 .ant-tabs-tabpane 强制 display:flex（会盖掉 display:none）

若本轮确认了新的最终方案或明确否决了某方案，会话结束时会由 stop hook 自动回写记忆；也可主动调用 `./scripts/upload_memory.sh`。
