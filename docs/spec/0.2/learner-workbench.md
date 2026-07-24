# 学员工作台 Spec（0.2）

## 1. 信息架构

```text
Login
  └── Workbench
        ├── Header：品牌 / 营期 / Day 选择 / 用户 / 退出
        ├── Left：当日节点列表（状态胶囊）
        ├── Center：当前节点面板（learn|quiz|lab|project|review|unlock）
        └── Right：AI 导师 + Passport 摘要
```

主路径：

```text
Learn → Quiz → Lab(Agent) → Project → Review → Unlock → Passport
```

## 2. 屏幕与职责

### 2.1 登录屏

- 邮箱 + 密码 + 营期 ID  
- 次要：邀请码 `FDE-DEMO`  
- 错误：凭证错误时内联提示，不跳转空白页  
- 文案：标明「FDE 0.2 学员工作台 · 演示账号已预填」

### 2.2 工作台 Header

| 元素 | 行为 |
|------|------|
| 标题 | 「FDE 学员工作台」 |
| 副文案 | `email · camp_id · day标题` |
| Day 选择 | Day1 / Day2（切换后重新拉 Day 包） |
| 退出 | 清 token，回登录屏 |

### 2.3 左栏 · 节点列表

每个节点展示：`标题` + 状态 pill。

| status | 展示 | 可点击 |
|--------|------|--------|
| locked | 灰 | 可点查看但操作按钮禁用并提示「先完成前置」 |
| available | 绿边 | 进入面板，可操作 |
| passed | 浅绿 | 可回顾，主要按钮变为「已完成」 |

当前选中节点高亮。

### 2.4 中栏 · 节点面板

#### learn（今日知识胶囊）

- 标题：节点 title  
- 正文：`learn.steps[]` 列表（**不依赖灵知**）  
- 元信息：预计分钟、lingzhi_tags（只读展示）  
- CTA：`完成学习` → `POST /nodes/{id}/complete`

#### quiz

- 渲染 `quiz.questions[]`  
- 提交 → `POST /quiz/submit`  
- 通过：自动解锁下一节点并刷新列表  
- 未通过：显示得分与 pass_rate，允许重做  

#### lab（Agent）

- 显示 `lab.runner`、提示词（可编辑）  
- `启动 Agent` → ensure workspace + create job + SSE  
- iframe 预览 `index.html`  
- `评测` → EvalBridge  
- `通过并完成` → 写 evidence + complete node  
- locked 时按钮 disabled  

#### project / review / unlock

- 短说明 + `标记完成`（门禁同 complete API）

### 2.5 右栏

- **AI 导师**：提问；展示 reply + level + citations（可为空 / offline）  
- **Passport**：cert_id、tracks、evidence_count  
- **Memories（可选）**：上传文本；无 Key 时展示友好错误  

## 3. 空态 / 错误态

| 场景 | 表现 |
|------|------|
| 未登录 | 仅登录屏 |
| Day 包 404 | 中栏提示「本日任务未配置」 |
| Agent 429 | toast/日志：已有进行中任务 |
| 节点 locked 点操作 | 按钮 disabled + 文案「请先完成上一节点」 |
| Kb offline | Coach 仍返回兜底 steps，标注 offline |

## 4. 非功能

- 同域 API（`location.origin`），Bearer + cookie 双通道  
- 桌面优先；&lt;960px 单列堆叠  
- 不引入构建链；单 HTML 可静态挂载  

## 5. 验收对照

见 [acceptance.md](./acceptance.md) A1–A8。
