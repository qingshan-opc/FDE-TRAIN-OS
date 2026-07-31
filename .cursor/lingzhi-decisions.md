## 灵芝防回归记忆（自动注入）

以下为本企业知识库中已沉淀的**已采纳决策**与**被否决方案**。
编码时必须遵守；**禁止回退到 anti-pattern 中列出的旧方案**。
工作区提示: `digital-fde-platform`

### 已采纳决策 (tag=decision)
- **决策记忆 digital-fde-platform 2026-07-30**: 该文档记录了2026年7月30日关于digital-fde-platform工作区的决策记忆。系统已在运行且无需重启，提供了三个访问链接：首页、学员台和登录页面。健康检查确认API、Postgres和MinIO服务均正常，登录测试成功。登录凭据为`learner@fde.local`和密码`learner1234`。用户可直接打开提供的链接使用系统。
- **决策记忆 digital-fde-platform 2026-07-28**: 该文档记录了2026年7月28日关于`digital-fde-platform`工作区中弹窗居中问题的修复决策。问题在于弹窗未能在视口正中显示，最终采用三种方案解决：将弹窗挂载到`document.body`、使用`top/left: 50%`加`transform: translate(-50%, -50%)`实现居中，并添加半透明遮罩层和轻微模糊效果。修复后，刷新链上详情页并点击「证书核验」即可看到居中弹窗。该决策由Cursor自动沉淀，标记为决策记忆。
- **决策记忆 digital-fde-platform 2026-07-27**: 该文档记录了2026年7月27日关于`digital-fde-platform`工作区中macOS系统数据占用问题的决策。经实测，约701GB的“系统数据”并非真正的系统文件，而是由Docker Desktop（162GB）、Chrome代码签名克隆（124GB）、Cursor状态库（67GB）等开发工具残留文件构成。文档提供了安全清理优先级，建议优先清理Chrome克隆（约124GB）和Docker构建缓存（可回收约200GB+），并警告Cursor清理会丢失本地聊天索引。
- **决策记忆 digital-fde-platform 2026-07-26**: # 决策记忆 digital-fde-platform 2026-07-26  _session_id: `aa518757-17ba-4827-8161-d54094af52a7`_ ## 问题 / 背景 工作区: `digital-fde-platform` session_id: `aa518757-17ba-4827-8161-d54094af52a7`  ## 试过什么 / 最终采用 / 效果  已整理进 `class/bootcamp/day-05/section
- **决策记忆 digital-fde-platform 2026-07-24**: 该文档记录了在`digital-fde-platform`工作区中，为解决终端命令问题而做出的决策。用户通过设置别名`kimi`来启动K3后端的Claude Code，该命令指向Kimi K3模型（订阅版，1M上下文）。而原有的`claude`命令则指向阿里云qwen3.8模型，其配额在指定时间后才恢复。使用`kimi`命令前需确保在新终端中执行`source ~/.zshrc`，或先运行该命令以避免提示找不到命令。进入后可通过`/status`确认base URL和模型信息
- **决策记忆 digital-fde-platform 2026-07-23**: 该文档记录了2026年7月23日对`digital-fde-platform`工作区个人中心页面的布局重构决策。原移动端“窄栏+卡片堆叠”样式被改为电脑端左侧菜单（240px）加右侧内容区（padding 48px）的布局，并新增了`LearnerAccountLayout`组件供三页共用。`Profile.tsx`被重构为桌面两栏结构，左侧显示基本资料，右侧显示认证与证书摘要，同时`Identity.tsx`和`Certificates.tsx`也接入了同一布局并去除了底部
- **决策记忆 lingqi-os 2026-07-31**: 本次提交（`13d0fbee`）已推送至 `main` 分支，共修改 22 个文件（+817/−225）。核心内容包括引入“开放验证方法论”（含 `discoverable_verification`、prompt、`verify-discover` skill 等）以及多项 Workbench 修复（如去掉主机启动短路、优化拷问/AskUserQuestion UI 等）。部分本地产物（如 `.cursor/lingzhi-decisions.md`、dashboard 下
- **决策记忆 lingqi-os 2026-07-31**: 该文档记录了2026年7月31日关于lingqi-os内核内存子系统的决策分析。核心结论是当前内存核心代码仅约5-6千行，远少于Linux的20万行，但这是刻意为之的瘦身设计，并非能力不足。文档指出，团队专注于可验证的主链（如buddy/heap、页表、缺页、mmap/COW、swap、OOM）和AI-native差异化方向，而非堆砌Linux的横切复杂度。要实现L5可交付级别，关键在于真机验证和产品化，而非增加代码行数；通用内存SOTA则需2-5年演进。最终建议按AI-na
- **决策记忆 anycode 2026-07-30**: 本次决策针对 anycode 工作区，移除了主机启动的自动短路逻辑。具体修改包括：在 `chat_runtime/mod.rs` 中删除了 `is_start_server_intent` 相关的整条短路路径，不再自动注入 `host_intent_hint` 或专用 `tool_deny`；`start_server_intent.rs` 中的 helper 函数被保留但不再被 runtime 自动调用；`bash.rs` 中 `looks_like_long_runnin
- **决策记忆 digital-lingzhi-platform 2026-07-30**: 该文档记录了2026年7月30日针对`digital-lingzhi-platform`工作区的一次决策。由于本机FDE MinIO服务已占用`:9000`端口，团队采用`docker-compose.fde-ports.yml`配置文件实现服务共存启动。同时修复了worker中Redis `BRPOP`命令的超时问题，原因是redis-py 8默认的5秒超时与阻塞等待逻辑冲突。部署后各服务地址已明确：Web管理后台为`http://127.0.0.1:8231`，API为`
- **决策记忆 digital-lingzhi-platform 2026-07-23**: # 决策记忆 digital-lingzhi-platform 2026-07-23  _session_id: `45d26a27-154e-41e1-8ae9-7d06eaf744e1`_ ## 问题 / 背景 工作区: `digital-lingzhi-platform` session_id: `45d26a27-154e-41e1-8ae9-7d06eaf744e1`  ## 试过什么 / 最终采用 / 效果  **灵知知识库 · 企业 AI 转型第一站**  企业
- **决策记忆 digital-ai-wechat 2026-07-22**: 该文档记录了2026年7月22日关于`digital-ai-wechat`工作区的一次决策。决策内容为关闭PadPro容器（包含MySQL和Redis服务）以及采集进程，导致端口`:8059`无法访问。该记录由Cursor stop hook自动沉淀生成，并标记为决策记忆。

### 避坑清单 (tag=anti-pattern)
- **避坑: Ant Tabs 不要全局 display:flex**: # 避坑: Ant Tabs 不要全局 display:flex ## 问题 Dedup/Integrations tab 无法点击 ## 最终采用 只对 .ant-tabs-tabpane-active 设 display:flex ## 不要再做 不要对所有 .ant-tabs-tabpane 强制 display:flex（会盖掉 display:none）

若本轮确认了新的最终方案或明确否决了某方案，会话结束时会由 stop hook 自动回写记忆；也可主动调用 `./scripts/upload_memory.sh`。
