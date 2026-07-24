/**
 * 对齐《FDE Learning OS 任务驱动型培训平台报告》颗粒度：
 * 训练营(21天) → 每日任务编排(知识卡片→测验→实验→企业/小组任务→评审→解锁)
 * 内容资产：知识单元 / Skill / 实验单元 / 企业任务 / 评估单元
 * AI 导师：LEVEL1 提示方向 → LEVEL2 局部示例 → LEVEL3 参考方案
 */

const SCREENS = [
  { id: "s01", name: "官网首页", group: "获客转化" },
  { id: "s02", name: "城市班详情", group: "获客转化" },
  { id: "s03", name: "登录注册", group: "获客转化" },
  { id: "s04", name: "能力诊断", group: "获客转化" },
  { id: "s05", name: "支付确认", group: "获客转化" },
  { id: "s06", name: "支付成功", group: "获客转化" },
  { id: "s-learn", name: "今日学习", group: "学习交付" },
  { id: "s07", name: "每日任务中心", group: "学习交付" },
  { id: "s08", name: "日任务编排", group: "学习交付" },
  { id: "s09", name: "项目工作台", group: "学习交付" },
  { id: "s10", name: "交互实验", group: "实验室AI" },
  { id: "s11", name: "AI 导师", group: "实验室AI" },
  { id: "s12", name: "动态故障", group: "实验室AI" },
  { id: "s13", name: "作业评审", group: "评测作品" },
  { id: "s14", name: "答辩复盘", group: "评测作品" },
  { id: "s15", name: "公开作品页", group: "评测作品" },
  { id: "s16", name: "能力档案", group: "评测作品" },
  { id: "s17", name: "导师审核台", group: "导师运营" },
  { id: "s18", name: "运营后台", group: "导师运营" },
];

const NODE_TYPES = [
  { id: "card", label: "知识卡片", short: "学习" },
  { id: "quiz", label: "快速测验", short: "确认" },
  { id: "lab", label: "操作实验", short: "会做" },
  { id: "project", label: "小组/企业任务", short: "交付" },
  { id: "review", label: "评审整改", short: "验收" },
  { id: "unlock", label: "能力更新", short: "解锁" },
];

const LESSON_TYPES = [
  ["知识卡片", "短文本、图解、案例、代码片段、五分钟检查题"],
  ["操作步骤", "目标 → 环境 → 步骤 → 预期结果 + 常见报错"],
  ["交互式实验", "在线编辑、模板库、模拟企业数据、一键测试"],
  ["企业任务书", "背景、组织、数据、老板需求、缺失信息与交付要求"],
  ["AI 导师", "解释、报错、流程、模拟访谈；三级帮助不直给完整答案"],
  ["导师评审", "答疑、点评、模拟客户、阶段验收、结业答辩"],
];

const ASSETS = [
  { type: "知识单元", example: "API / 数据字典 / AI 幻觉 / Agent 工具调用" },
  { type: "Skill 单元", example: "财务异常分析 / 会议纪要 / 客户分层" },
  { type: "实验单元", example: "创建 FastAPI / 连库 / ECharts / 搭落地页" },
  { type: "企业任务", example: "财务驾驶舱 / 销售客户系统 / 人效分析" },
  { type: "评估单元", example: "自动测试 / 代码评审 / 业务答辩 / 验收表" },
  { type: "引用关系", example: "资产被哪些训练营版本、日任务调用" },
];

/** 21 天训练营中的若干日（演示用子集，结构对齐报告） */
const CAMP_DAYS = [
  {
    day: 1,
    title: "环境与企业问题建模",
    project: "经营驾驶舱 · 启动",
    unlocked: true,
    nodes: defaultNodes({
      card: "AS-IS 流程与数据字典入门",
      quiz: "识别三类业务异常信号",
      lab: "创建项目仓库并跑通 Hello API",
      project: "小组：梳理老板要的三张经营看板",
    }),
  },
  {
    day: 2,
    title: "页面交付与线索收集",
    project: "销售线索页",
    unlocked: true,
    nodes: defaultNodes({
      card: "语义化页面与转化漏斗",
      quiz: "移动端验收清单",
      lab: "做一个线索收集落地页（实验单元）",
      project: "企业任务：为销售部上线可访问预览页",
    }),
  },
  {
    day: 3,
    title: "财务异常与 AI 分析",
    project: "财务驾驶舱",
    unlocked: true,
    nodes: defaultNodes({
      card: "财务异常口径与 AI 幻觉风险",
      quiz: "哪些指标不能直接信模型",
      lab: "连接模拟账套并出一张异常表",
      project: "企业任务书：财务驾驶舱异常模块（差异化数据）",
    }),
  },
  {
    day: 7,
    title: "Agent 工具与审批边界",
    project: "运维 Agent",
    unlocked: false,
    nodes: defaultNodes({
      card: "Workflow vs Agent Loop",
      quiz: "高风险动作识别",
      lab: "注册一个只读工具",
      project: "小组：带人工审批的运维助手",
    }),
  },
  {
    day: 14,
    title: "人效分析系统",
    project: "人效看板",
    unlocked: false,
    nodes: defaultNodes({
      card: "组织与岗位数据模型",
      quiz: "隐私与最小必要",
      lab: "ECharts 人效对比图",
      project: "企业任务：人效分析周报自动化",
    }),
  },
  {
    day: 21,
    title: "结业答辩与认证",
    project: "综合交付",
    unlocked: false,
    nodes: defaultNodes({
      card: "答辩提纲与证据链",
      quiz: "认证绑定哪些证据",
      lab: "作品集导出检查",
      project: "结业：经营驾驶舱终验 + 客户式答辩",
    }),
  },
];

function defaultNodes({ card, quiz, lab, project }) {
  return [
    { type: "card", title: card, asset: "知识单元", pass: "读完并完成嵌入检查题", output: "测验前准备完成" },
    { type: "quiz", title: quiz, asset: "评估单元", pass: "正确率 ≥ 80%", output: "测验记录" },
    { type: "lab", title: lab, asset: "实验单元", pass: "自动测试通过", output: "实验结果 / 错误轨迹" },
    { type: "project", title: project, asset: "企业任务", pass: "提交看板更新与可验证产出", output: "代码/文档/贡献" },
    { type: "review", title: "自动测试 + AI 初审 + 导师抽检", asset: "评估单元", pass: "无阻断项或完成整改", output: "评分与整改单" },
    { type: "unlock", title: "更新能力标签并解锁次日任务", asset: "引用关系", pass: "当日节点全部通过", output: "能力档案变更" },
  ];
}

/** 学习材料：每日随训练营版本下发，服务当日企业任务（文档即课程） */
const LEARN_BY_DAY = {
  1: {
    title: "AS-IS 流程与数据字典入门",
    excerpt: "先画清企业现状流程与字段含义，再谈系统和 AI。",
    minutes: 18,
    body: `
      <h4>AS-IS 流程与数据字典入门</h4>
      <p>今天的企业任务是「梳理老板要的三张经营看板」。学习目标不是背概念，而是能画出：谁产生数据、谁消费数据、哪些口径容易吵起来。</p>
      <h5>你要带走的 3 点</h5>
      <ul>
        <li>AS-IS：如实描述现状，不先画理想 TO-BE。</li>
        <li>数据字典：每个指标写清定义、来源表、更新频率、负责人。</li>
        <li>缺失信息也要记：老板没说清的地方，正是后续访谈题。</li>
      </ul>
      <h5>操作步骤（读完就按这个做）</h5>
      <ul>
        <li>目标：完成一页 AS-IS + 10 个关键字段字典。</li>
        <li>准备：小组企业背景包（已注入差异化数据）。</li>
        <li>预期：能向同伴讲清「利润」可能有哪 3 种口径。</li>
      </ul>
      <div class="video-chip">辅助短视频 4′ · 如何访谈业务方（可选）</div>
    `,
    quizPrompt: "老板说「利润不对」时，你应首先对齐哪类信息？",
  },
  2: {
    title: "语义化页面与转化漏斗",
    excerpt: "做一个能收集线索的落地页：结构清晰、可访问、可验收。",
    minutes: 15,
    body: `
      <h4>语义化页面与转化漏斗</h4>
      <p>今日实验是「线索收集落地页」。先学：信息架构 → 英雄区与 CTA → 表单校验 → 移动端验收。视频只示范操作，不承担课程主体。</p>
      <h5>完成判据（学习侧）</h5>
      <ul>
        <li>能说出每个区块对应漏斗哪一步。</li>
        <li>知道表单错误提示为何要可见、可聚焦。</li>
        <li>375 / 768 断点各检查一遍的清单。</li>
      </ul>
      <div class="video-chip">辅助短视频 6′ · 表单校验演示（可选）</div>
    `,
    quizPrompt: "移动端验收时，最容易漏掉的是哪一项？",
  },
  3: {
    title: "财务异常口径与 AI 幻觉风险",
    excerpt: "先固定口径，再让 AI 解读；否则驾驶舱会「一本正经地错」。",
    minutes: 20,
    body: `
      <h4>财务异常口径与 AI 幻觉风险</h4>
      <p>学习从训练营日包下发：本卡片 + 操作指南，专门服务今日企业任务「财务驾驶舱异常模块」。没有单独的「视频课目录」——知识跟着当天任务走。</p>
      <h5>为什么先学再做</h5>
      <ul>
        <li>收入确认时点、退货冲回、子公司合并范围未对齐时，模型会编造「合理解释」。</li>
        <li>你要先有口径表，再接异常规则，最后才是 AI 解读文案。</li>
        <li>差异化数据：每组账套不同，抄别人结论会直接测挂。</li>
      </ul>
      <h5>操作步骤</h5>
      <ul>
        <li>目标：写出 5 条异常规则的人话定义。</li>
        <li>准备：模拟账套 V0.3 + 今日任务书。</li>
        <li>预期：能举例说明「模型说利润下降」时你如何证伪。</li>
      </ul>
      <div class="video-chip">辅助短视频 5′ · 口径对齐工作坊节选（可选）</div>
    `,
    quizPrompt: "哪些指标不能直接信模型输出？",
  },
  7: {
    title: "Workflow vs Agent Loop",
    excerpt: "分清确定性流程与智能体循环，以及高风险动作的审批边界。",
    minutes: 16,
    body: `
      <h4>Workflow vs Agent Loop</h4>
      <p>今日任务要配「带人工审批的运维助手」。先学选型边界：能写成确定性步骤的别塞进 Loop；会改生产状态的动作必须审批。</p>
      <div class="video-chip">辅助短视频 7′ · 审批流配置演示（可选）</div>
    `,
    quizPrompt: "高风险动作识别题",
  },
  14: {
    title: "组织与岗位数据模型",
    excerpt: "人效分析前先搞清组织树、岗位与隐私最小必要。",
    minutes: 14,
    body: `
      <h4>组织与岗位数据模型</h4>
      <p>为「人效分析看板」准备：组织树、岗位、工时与产出指标；强调隐私与最小必要原则。</p>
    `,
    quizPrompt: "隐私与最小必要",
  },
  21: {
    title: "答辩提纲与证据链",
    excerpt: "结业不是交代码，而是证明你能交付并被验收。",
    minutes: 12,
    body: `
      <h4>答辩提纲与证据链</h4>
      <p>认证绑定：提交记录、实验、项目、导师评分与答辩表现。学习如何组织 10 分钟客户式汇报。</p>
    `,
    quizPrompt: "认证绑定哪些证据",
  },
};

function learnForDay(dayNum = currentDay().day) {
  return LEARN_BY_DAY[dayNum] || LEARN_BY_DAY[3];
}

function learningCleared(day = currentDay()) {
  return !!(state.doneNodes[nodeKey(day.day, 0)] && state.doneNodes[nodeKey(day.day, 1)]) || !!state.doneDays[day.day];
}

const LAB_SKILLS = [
  { id: "lab-page", name: "做一个线索落地页", minutes: 40, pass: "预览可访问 + 表单校验" },
  { id: "lab-api", name: "创建 FastAPI 健康检查", minutes: 30, pass: "/health 返回 ok" },
  { id: "lab-chart", name: "ECharts 展示异常趋势", minutes: 35, pass: "图与数据源对齐" },
];

const ENTERPRISE_TASKS = [
  { id: "ent-finance", name: "财务驾驶舱异常模块", minutes: 240, pass: "指标、异常、AI 解读、汇报页" },
  { id: "ent-sales", name: "销售客户系统最小闭环", minutes: 300, pass: "客户分层 + 跟进记录" },
  { id: "ent-hr", name: "人效分析看板", minutes: 240, pass: "周报可导出" },
  { id: "ent-prod", name: "生产异常看板", minutes: 240, pass: "告警规则可配置" },
];

const MILESTONES = [
  { name: "M1 问题澄清", status: "done" },
  { name: "M2 数据与口径", status: "done" },
  { name: "M3 页面/接口可演示", status: "current" },
  { name: "M4 AI 分析可信", status: "locked" },
  { name: "M5 答辩验收", status: "locked" },
];

const ARTIFACTS = ["需求确认单", "数据口径说明", "运行预览", "测试报告", "小组贡献记录", "复盘文档"];

const HELP_LEVELS = [
  { id: 0, name: "LEVEL 1 提示方向", desc: "指出应检查的范围、变量或步骤" },
  { id: 1, name: "LEVEL 2 局部示例", desc: "相似案例、伪代码或部分实现" },
  { id: 2, name: "LEVEL 3 参考方案", desc: "提交失败原因后开放，计入档案" },
];

const COACH_MODES = {
  explain: "解释内容",
  debug: "分析报错",
  process: "检查流程",
  roleplay: "模拟访谈",
  drill: "个性化练习",
  review: "AI 初审",
};

const DIAG_QUESTIONS = [
  {
    q: "FDE Learning OS 的主线单位更接近？",
    options: ["长视频章节", "每日可验收任务编排", "题库刷题", "直播打卡"],
    answer: 1,
  },
  {
    q: "AI 导师 LEVEL 3 参考方案应何时开放？",
    options: ["一上来就给", "多次失败并提交原因说明后", "任意付费即可", "永远不给"],
    answer: 1,
  },
  {
    q: "企业任务书应包含？",
    options: ["仅标准答案代码", "背景、数据、老板需求与部分缺失信息", "完整视频目录", "证书模板"],
    answer: 1,
  },
];

const STORAGE_KEY = "fde-mvp-proto-state-v4";

const defaultState = () => ({
  loggedIn: false,
  paid: false,
  profile: null,
  diagStep: 0,
  diagDone: false,
  dayIndex: 2, // Day 3
  nodeIndex: 0,
  doneNodes: {}, // key: `${day}-${nodeIndex}`
  doneDays: {},
  labSkillId: "lab-page",
  enterpriseId: "ent-finance",
  artifacts: Object.fromEntries(ARTIFACTS.map((a) => [a, false])),
  labRunning: false,
  faultFixed: false,
  coachLevel: 0,
  coachMode: "explain",
  coachOpen: false,
  failCount: 0,
  learnTab: "card",
  evalPassed: false,
  reviewStatus: "none",
  publicPortfolio: false,
  verifyId: "",
  mentorComment: "",
  opsTab: "cohort",
  afterLogin: "s05",
});

let state = loadState();

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentDay() {
  return CAMP_DAYS[state.dayIndex] || CAMP_DAYS[0];
}

function currentNode() {
  const day = currentDay();
  return day.nodes[Math.min(state.nodeIndex, day.nodes.length - 1)];
}

function nodeKey(dayNum, idx) {
  return `${dayNum}-${idx}`;
}

function toast(message) {
  const host = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function go(id) {
  const target = SCREENS.some((s) => s.id === id) ? id : "s01";
  if (location.hash !== `#${target}`) location.hash = target;
  else render();
}

function currentScreenId() {
  const hash = location.hash.replace("#", "");
  return SCREENS.some((s) => s.id === hash) ? hash : "s01";
}

function buildNav() {
  const nav = document.getElementById("side-nav");
  const groups = [...new Set(SCREENS.map((s) => s.group))];
  nav.innerHTML = groups
    .map((group) => {
      const items = SCREENS.filter((s) => s.group === group)
        .map(
          (s) => `
          <a href="#${s.id}" data-nav="${s.id}">
            <span class="sid">${s.id.toUpperCase()}</span>
            <span>${s.name}</span>
          </a>`
        )
        .join("");
      return `<div class="nav-group"><h3>${group}</h3><div class="nav-list">${items}</div></div>`;
    })
    .join("");
}

function renderPills() {
  const host = document.getElementById("state-pills");
  const pills = [
    ["已登录", state.loggedIn],
    ["已付费", state.paid],
    ["实验中", state.labRunning],
    ["评测过", state.evalPassed],
    ["导师开", state.coachOpen],
  ];
  host.innerHTML = pills
    .map(([label, on]) => `<span class="pill" data-on="${on}">${label}</span>`)
    .join("");
}

function campProgress() {
  const done = Object.keys(state.doneDays).length;
  const total = 21;
  const pct = Math.round((done / total) * 100);
  return { done, total, pct };
}

function renderDayCenter() {
  const day = currentDay();
  const node = currentNode();
  const title = document.getElementById("day-title");
  if (title) title.textContent = `Day ${day.day} · 今日必做`;

  const learn = learnForDay(day.day);
  const next = document.getElementById("next-step-text");
  if (next) {
    if (state.doneDays[day.day]) next.textContent = `今日已通过 · 学习与任务证据已写入能力档案`;
    else if (!state.doneNodes[nodeKey(day.day, 0)]) next.textContent = `下一步：学习「${learn.title}」（约 ${learn.minutes} 分钟）`;
    else if (!state.doneNodes[nodeKey(day.day, 1)]) next.textContent = `学习已读 · 去做快速测验确认`;
    else next.textContent = `学习已过 · 当前：${NODE_TYPES.find((n) => n.id === node.type)?.label} · ${node.title}`;
  }

  const learnTitle = document.getElementById("today-learn-title");
  const learnExcerpt = document.getElementById("today-learn-excerpt");
  if (learnTitle) learnTitle.textContent = learn.title;
  if (learnExcerpt) learnExcerpt.textContent = `${learn.excerpt} · 预计 ${learn.minutes} 分钟阅读`;

  const blurb = document.getElementById("learn-source-blurb");
  if (blurb) {
    blurb.textContent =
      "学习材料由教研按训练营版本编排进「当日包」：知识卡片 + 操作步骤（可附 3–8 分钟短视频）。它为今天的企业任务服务，学完测验通过后才解锁实验与项目。";
  }

  const badge = document.getElementById("cp-badge");
  if (badge) badge.textContent = `节点 ${Math.min(state.nodeIndex + 1, day.nodes.length)}/${day.nodes.length}`;

  const prog = campProgress();
  const bar = document.getElementById("wb-progress");
  const text = document.getElementById("wb-progress-text");
  if (bar) bar.style.width = `${Math.max(prog.pct, 5)}%`;
  if (text) text.textContent = `21 天训练营 · 已通过 ${prog.done} 日（演示轴展示关键日）`;

  const project = document.getElementById("project-summary");
  if (project) project.textContent = `${day.project} · 小组 B · ${MILESTONES.find((m) => m.status === "current")?.name || "进行中"}`;

  const note = document.getElementById("mentor-note");
  if (note) {
    if (state.reviewStatus === "pass") note.textContent = `导师通过：${state.mentorComment}`;
    else if (state.reviewStatus === "pending") note.textContent = "待导师复核 AI 初审结果";
    else if (state.reviewStatus === "revise") note.textContent = `整改中：${state.mentorComment}`;
    else note.textContent = "日终：自动测试 + AI 初审；业务真实性由导师验收。";
  }

  const dayGrid = document.getElementById("day-grid");
  if (dayGrid) {
    dayGrid.innerHTML = CAMP_DAYS.map((d, i) => {
      const active = i === state.dayIndex;
      const done = !!state.doneDays[d.day];
      const L = learnForDay(d.day);
      return `<article class="card course-card ${active ? "active" : ""}" data-action="select-day" data-day-index="${i}">
        <div style="display:flex;justify-content:space-between">
          <span class="badge">Day ${d.day}</span>
          <span class="muted">${done ? "已通过" : d.unlocked ? "先学再做" : "未解锁"}</span>
        </div>
        <h3 style="margin:8px 0 4px">${d.title}</h3>
        <p><strong>学：</strong>${L.title}</p>
        <p class="muted">做：${d.project}</p>
      </article>`;
    }).join("");
  }

  const assetGrid = document.getElementById("asset-grid");
  if (assetGrid) {
    assetGrid.innerHTML = ASSETS.map(
      (a) => `<article class="card"><h4>${a.type}</h4><p class="muted">${a.example}</p></article>`
    ).join("");
  }
}

function renderOrchestration() {
  const day = currentDay();
  const node = currentNode();
  const learn = learnForDay(day.day);
  const cleared = learningCleared(day);
  const title = document.getElementById("course-title");
  const desc = document.getElementById("course-desc");
  if (title) title.textContent = `Day ${day.day} · ${day.title}`;
  if (desc) {
    desc.textContent = `学习包：${learn.title} → 服务项目：${day.project} · 训练营 V0.3`;
  }

  const flowHint = document.getElementById("flow-hint");
  if (flowHint) {
    flowHint.textContent = cleared
      ? "学习与测验已通过：实验 / 企业任务已解锁。"
      : "前两步是学习与确认；点后面的「实验/项目」会被拦回学习（演示规则）。";
  }

  const flow = document.getElementById("orchestrate-flow");
  if (flow) {
    flow.innerHTML = day.nodes
      .map((n, i) => {
        const meta = NODE_TYPES.find((t) => t.id === n.type);
        const done = !!state.doneNodes[nodeKey(day.day, i)] || i < state.nodeIndex || state.doneDays[day.day];
        const active = i === state.nodeIndex && !state.doneDays[day.day];
        const locked = i >= 2 && !cleared && !done;
        return `<button type="button" class="flow-node ${active ? "active" : ""} ${done && !active ? "done" : ""} ${locked ? "locked" : ""}" data-action="select-node" data-node-index="${i}" ${locked ? 'aria-disabled="true"' : ""}>
          <small>${i < 2 ? "学" : meta?.short || n.type}</small>
          <div>${meta?.label || n.type}</div>
        </button>`;
      })
      .join("");
  }

  renderLearnPanel(day, node, learn, cleared);

  const typeBadge = document.getElementById("task-type-badge");
  if (typeBadge) {
    typeBadge.className = `task-type ${node.type === "project" ? "complex" : "micro"}`;
    typeBadge.textContent = NODE_TYPES.find((n) => n.id === node.type)?.label || node.type;
  }

  document.getElementById("cp-detail-title").textContent = node.title;
  document.getElementById("cp-detail-list").innerHTML = `
    <li>阶段：${node.type === "card" || node.type === "quiz" ? "学习确认" : "练习 / 交付 / 验收"}</li>
    <li>引用资产：${node.asset}</li>
    <li>通过条件：${node.pass}</li>
    <li>形成证据：${node.output}</li>
    <li>学习来源：当日训练营内容包（非独立视频课目录）</li>`;

  const btn = document.getElementById("btn-complete-task");
  if (btn) {
    if (node.type === "card") btn.textContent = "学完了，去做测验";
    else if (node.type === "quiz") btn.textContent = "提交测验并解锁实验";
    else btn.textContent = "完成本节点";
  }

  const list = document.getElementById("checkpoint-list");
  if (list) {
    list.innerHTML = day.nodes
      .map((n, i) => {
        let status = i >= 2 && !cleared ? "先完成学习" : "锁定";
        let cls = "";
        if (state.doneDays[day.day] || i < state.nodeIndex || state.doneNodes[nodeKey(day.day, i)]) status = "已通过";
        if (i === state.nodeIndex && !state.doneDays[day.day]) {
          status = "进行中";
          cls = "current";
        }
        return `<div class="checkpoint ${cls}"><span>${i + 1}. ${NODE_TYPES.find((t) => t.id === n.type)?.label}</span><span>${status}</span></div>`;
      })
      .join("");
  }

  const micro = document.getElementById("micro-task-list");
  if (micro) {
    micro.innerHTML = LAB_SKILLS.map(
      (t) => `<div class="task-row">
        <span class="task-type micro">实验</span>
        <div><strong>${t.name}</strong><p class="muted">${t.minutes} 分钟 · ${t.pass}</p></div>
        <button type="button" class="btn ${state.labSkillId === t.id ? "btn-primary" : ""}" data-action="select-lab" data-id="${t.id}">选用</button>
      </div>`
    ).join("");
  }

  const complex = document.getElementById("complex-task-list");
  if (complex) {
    complex.innerHTML = ENTERPRISE_TASKS.map(
      (t) => `<div class="task-row">
        <span class="task-type complex">企业</span>
        <div><strong>${t.name}</strong><p class="muted">${t.minutes} 分钟 · ${t.pass}</p></div>
        <button type="button" class="btn ${state.enterpriseId === t.id ? "btn-primary" : ""}" data-action="select-ent" data-id="${t.id}">选用</button>
      </div>`
    ).join("");
  }
}

function renderLearnPage() {
  const day = currentDay();
  const learn = learnForDay(day.day);
  const tab = state.learnTab || "card";

  const dayEl = document.getElementById("learn-page-day");
  const titleEl = document.getElementById("learn-page-title");
  const metaEl = document.getElementById("learn-page-meta");
  const doc = document.getElementById("learn-page-doc");
  const actions = document.getElementById("learn-page-actions");
  if (!doc) return;

  if (dayEl) dayEl.textContent = `Day ${day.day} · 训练营内容包 V0.3 · 主线 ${day.project}`;
  if (titleEl) titleEl.textContent = learn.title;
  if (metaEl) metaEl.textContent = `必读 · 约 ${learn.minutes} 分钟 · 服务今日企业任务「${day.project}」`;

  document.querySelectorAll("#learn-toc .toc-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  if (tab === "card") {
    doc.innerHTML = learn.body;
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" data-action="learn-tab" data-tab="steps">下一步：操作步骤</button>
        <button type="button" class="btn" data-action="open-coach">这段没懂，问导师</button>`;
    }
  } else if (tab === "steps") {
    doc.innerHTML = `
      <h4>操作步骤（为实验做准备）</h4>
      <p><strong>任务目标 → 准备环境 → 操作步骤 → 预期结果</strong></p>
      <ol>
        <li>打开今日企业任务书，标出「缺失信息」。</li>
        <li>对照知识卡片，写下 3～5 条可测口径/规则。</li>
        <li>列出实验环境需要的数据与账号（模拟账套已注入）。</li>
        <li>预期：测验通过后，能在实验室按步骤复现，而不是边做边猜。</li>
      </ol>
      <p class="muted">对应报告：学习用文档看逻辑；实验才会操作；项目才交付。</p>`;
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" data-action="learn-tab" data-tab="video">看辅助短视频</button>
        <button type="button" class="btn" data-action="learn-tab" data-tab="card">返回知识卡片</button>`;
    }
  } else if (tab === "video") {
    doc.innerHTML = `
      <h4>辅助短视频（3–8 分钟，可选）</h4>
      <div class="video-stage">
        <div>
          <div style="font-size:1.4rem;font-weight:700;margin-bottom:8px">▶ 口径对齐工作坊节选</div>
          <div>05:20 · 不承担课程主体 · 只示范「怎么对口径」</div>
        </div>
      </div>
      <p style="margin-top:12px">视频可跳过；测验与实验仍以知识卡片和操作步骤为准。</p>`;
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" data-action="learn-tab" data-tab="quiz">去做快速测验</button>
        <button type="button" class="btn" data-action="learn-tab" data-tab="steps">返回操作步骤</button>`;
    }
  } else {
    doc.innerHTML = `
      <h4>快速测验 · 确认学懂了</h4>
      <p>通过后才会解锁交互实验与企业任务。</p>
      <p><strong>Q：${learn.quizPrompt}</strong></p>
      <label class="card" style="display:flex;gap:8px;margin-top:8px;cursor:pointer">
        <input type="radio" name="learn-quiz" value="a" />
        <span>A. 直接让模型给结论，再补页面</span>
      </label>
      <label class="card" style="display:flex;gap:8px;margin-top:8px;cursor:pointer">
        <input type="radio" name="learn-quiz" value="b" checked />
        <span>B. 先对齐口径 / 风险边界 / 验收标准（推荐）</span>
      </label>
      <label class="card" style="display:flex;gap:8px;margin-top:8px;cursor:pointer">
        <input type="radio" name="learn-quiz" value="c" />
        <span>C. 跳过学习，直接进项目抄上周答案</span>
      </label>`;
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" data-action="finish-reading">提交测验并解锁实验</button>
        <button type="button" class="btn" data-go="s08">查看全日编排</button>`;
    }
  }
}

function renderLearnPanel(day, node, learn, cleared) {
  const kicker = document.getElementById("learn-panel-kicker");
  const badge = document.getElementById("learn-panel-badge");
  const doc = document.getElementById("learn-doc");
  const actions = document.getElementById("learn-actions");
  if (!doc) return;

  if (node.type === "card") {
    if (kicker) kicker.textContent = "今日学习 · 知识卡片";
    if (badge) badge.textContent = `约 ${learn.minutes} 分钟 · 必读`;
    doc.innerHTML = learn.body;
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" data-action="complete-checkpoint">标记已学完</button>
        <button type="button" class="btn" data-action="ask-coach-about-task">不懂？问 AI 导师</button>`;
    }
  } else if (node.type === "quiz") {
    if (kicker) kicker.textContent = "今日学习 · 快速测验";
    if (badge) badge.textContent = "确认关键概念";
    doc.innerHTML = `
      <h4>测验：确认你学懂了</h4>
      <p>基于刚读的知识卡片。通过后才解锁实验与企业任务。</p>
      <h5>题目</h5>
      <p><strong>${learn.quizPrompt || node.title}</strong></p>
      <ul>
        <li>A. 直接让模型给结论</li>
        <li>B. 先对齐口径 / 风险边界 / 验收标准（推荐）</li>
        <li>C. 跳过学习去做项目</li>
      </ul>`;
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary" data-action="complete-checkpoint">提交测验（演示选 B）</button>
        <button type="button" class="btn" data-action="open-learn">返回知识卡片</button>`;
    }
  } else if (node.type === "lab") {
    if (kicker) kicker.textContent = "练习 · 操作步骤仍挂在学习侧";
    if (badge) badge.textContent = cleared ? "已解锁" : "需先完成学习";
    doc.innerHTML = `
      <h4>操作步骤（实验前复读）</h4>
      <p>任务目标 → 准备环境 → 操作步骤 → 预期结果。完整动手在「交互实验」里完成。</p>
      <p class="muted">今日实验：${node.title}</p>
      <div class="video-chip">调试类短视频仅辅助，不替代本步骤文档</div>`;
    if (actions) {
      actions.innerHTML = cleared
        ? `<button type="button" class="btn btn-primary" data-go="s10">打开交互实验</button>`
        : `<button type="button" class="btn btn-primary" data-action="open-learn">先去完成学习</button>`;
    }
  } else if (node.type === "project") {
    if (kicker) kicker.textContent = "交付 · 企业任务书";
    if (badge) badge.textContent = cleared ? "已解锁" : "需先完成学习";
    doc.innerHTML = `
      <h4>企业任务书（业务输入）</h4>
      <p>背景、组织、差异化数据、老板需求与<strong>部分缺失信息</strong>。学习卡片里的口径/方法，要在这里用出来。</p>
      <p><strong>今日交付主线：</strong>${day.project}</p>
      <p class="muted">${node.title}</p>`;
    if (actions) {
      actions.innerHTML = cleared
        ? `<button type="button" class="btn btn-primary" data-go="s09">打开项目工作台</button>`
        : `<button type="button" class="btn btn-primary" data-action="open-learn">先去完成学习</button>`;
    }
  } else {
    if (kicker) kicker.textContent = node.type === "review" ? "评审与整改" : "能力更新";
    if (badge) badge.textContent = "日终";
    doc.innerHTML = `
      <h4>${node.title}</h4>
      <p>学习证据（测验、阅读）与任务证据（实验、项目）一并进入能力档案；通过后解锁次日<strong>新的学习包</strong>。</p>`;
    if (actions) actions.innerHTML = `<button type="button" class="btn btn-primary" data-action="complete-checkpoint">确认</button>`;
  }
}

function renderProjectBoard() {
  const milestones = document.getElementById("milestone-list");
  if (milestones) {
    milestones.innerHTML = MILESTONES.map((m) => {
      const label = m.status === "done" ? "已完成" : m.status === "current" ? "进行中" : "未开始";
      return `<div class="checkpoint ${m.status === "current" ? "current" : ""}"><span>${m.name}</span><span>${label}</span></div>`;
    }).join("");
  }
  const teamProject = document.getElementById("team-project");
  if (teamProject) {
    const ent = ENTERPRISE_TASKS.find((t) => t.id === state.enterpriseId);
    teamProject.textContent = ent ? ent.name : currentDay().project;
  }
}

function renderArtifacts() {
  const grid = document.getElementById("artifact-grid");
  if (!grid) return;
  grid.innerHTML = ARTIFACTS.map((name) => {
    const done = state.artifacts[name];
    return `<article class="card ${done ? "ok" : ""}"><h4>${name}</h4><p>${done ? "已提交" : "待提交"}</p></article>`;
  }).join("");
}

function renderLab() {
  const status = document.getElementById("lab-status");
  if (!status) return;
  const skill = LAB_SKILLS.find((t) => t.id === state.labSkillId) || LAB_SKILLS[0];
  const ctx = document.getElementById("lab-coach-context");
  const nudge = document.getElementById("lab-coach-nudge");
  if (ctx) ctx.textContent = `看见：Day ${currentDay().day} / ${currentNode().title} / ${skill.name}`;
  if (nudge) {
    nudge.textContent = state.labRunning
      ? "AI 导师 LEVEL 1：先看测试失败断言，再改实现；不要直接要参考方案。"
      : "启动实验后，导师会结合报错与操作步骤给提示方向。";
  }

  if (!state.labRunning) {
    status.textContent = "实验环境未启动";
    document.getElementById("lab-files").textContent = "点击「启动环境」";
    document.getElementById("lab-editor").textContent = "# waiting…";
    document.getElementById("lab-term").textContent = "$";
    document.getElementById("lab-preview").textContent = "未就绪";
    return;
  }

  status.textContent = "lab-cohort-0 · 运行中 · 个性化数据集已注入";
  if (skill.id === "lab-page") {
    document.getElementById("lab-files").textContent = "index.html\nstyles.css\nform.js";
    document.getElementById("lab-editor").textContent = "<form id=\"lead\">…</form>";
    document.getElementById("lab-term").textContent = "$ npm test\n2 passed";
    document.getElementById("lab-preview").textContent = "线索页预览 OK";
  } else {
    document.getElementById("lab-files").textContent = "app/main.py\ntests/\ndata/";
    document.getElementById("lab-editor").textContent = "@app.get('/health')\ndef health(): return {'ok': True}";
    document.getElementById("lab-term").textContent = "$ pytest -q\n... ok";
    document.getElementById("lab-preview").textContent = "/health 200";
  }
}

function seedCoachChat(force = false) {
  const chat = document.getElementById("coach-chat");
  if (!chat) return;
  if (chat.dataset.seeded && !force) return;
  const node = currentNode();
  chat.innerHTML = `
    <div class="bubble coach"><strong>AI 导师</strong><br>当前：Day ${currentDay().day}「${node.title}」。我按三级帮助机制辅导，不会直接给完整标准答案。</div>
    <div class="bubble user"><strong>你</strong><br>我想看参考实现。</div>
    <div class="bubble coach"><strong>导师（LEVEL 1）</strong><br>${HELP_LEVELS[0].desc}：先对齐企业任务书里的「缺失信息」和通过条件，再动手。</div>`;
  chat.dataset.seeded = "1";
}

function renderCoach() {
  const levelEl = document.getElementById("coach-level");
  if (levelEl) levelEl.textContent = HELP_LEVELS[state.coachLevel].name;

  const list = document.getElementById("coach-context-list");
  if (list) {
    const node = currentNode();
    list.innerHTML = `
      <li>训练营：21 天 FDE 企业 AI 项目实战 · V0.3</li>
      <li>日任务：Day ${currentDay().day} · ${currentDay().title}</li>
      <li>节点：${NODE_TYPES.find((n) => n.id === node.type)?.label} · ${node.title}</li>
      <li>能力：${COACH_MODES[state.coachMode]} · ${HELP_LEVELS[state.coachLevel].name}</li>
      <li>原则：AI 初审规模化；最终认证归导师/企业</li>`;
  }

  document.querySelectorAll("#coach-mode-buttons [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.mode === state.coachMode ? "true" : "false");
  });

  seedCoachChat();

  const panel = document.getElementById("float-coach");
  const fab = document.getElementById("coach-fab");
  if (panel) panel.classList.toggle("open", state.coachOpen);
  if (fab) {
    const learner = ["s-learn", "s07", "s08", "s09", "s10", "s11", "s12", "s13", "s14"].includes(currentScreenId());
    fab.style.display = state.paid && learner ? "flex" : "none";
  }
  const floatNudge = document.getElementById("float-coach-nudge");
  if (floatNudge) {
    floatNudge.textContent = `${HELP_LEVELS[state.coachLevel].name} · ${COACH_MODES[state.coachMode]} · Day ${currentDay().day}`;
  }
}

function modeReply(mode, text) {
  const level = state.coachLevel;
  const prefix =
    level === 0
      ? "（LEVEL 1 方向）"
      : level === 1
        ? "（LEVEL 2 局部示例）"
        : "（LEVEL 3 参考方案·已记入档案）";

  const bodies = {
    explain: "围绕当前知识卡片的关键定义回答，并指出与企业任务书的对应关系。",
    debug: level === 0 ? "先定位失败断言与输入数据是否同一口径。" : "例如：校验合并范围字段后再重跑测试。",
    process: "对照操作步骤：环境 → 步骤 → 预期结果；缺哪一步补哪一步。",
    roleplay: "（老板）这份驾驶舱为什么和我财务口径不一致？给我三句话解释。",
    drill: "补充练习：用另一组子公司数据重做异常榜，提交前后对比。",
    review: "AI 初审：产出是否覆盖任务书交付点；业务真实性仍待导师确认。",
  };

  if (level === 2 && mode !== "roleplay") {
    return `${prefix} 可参考结构（非完整项目）：定义口径表 → 异常规则函数骨架 → 页面绑定只读 API。你的问题：「${text.slice(0, 24)}」`;
  }
  return `${prefix} ${bodies[mode] || bodies.explain}`;
}

function appendCoach(message, who = "coach", targetIds = ["coach-chat", "float-coach-chat"]) {
  targetIds.forEach((id) => {
    const chat = document.getElementById(id);
    if (!chat) return;
    const label = who === "user" ? "你" : `AI 导师（${COACH_MODES[state.coachMode]}）`;
    chat.insertAdjacentHTML(
      "beforeend",
      `<div class="bubble ${who === "user" ? "user" : "coach"}"><strong>${label}</strong><br>${message}</div>`
    );
    chat.scrollTop = chat.scrollHeight;
  });
}

function renderEval() {
  const tbody = document.querySelector("#eval-table tbody");
  const toDefense = document.getElementById("to-defense");
  if (!tbody) return;
  const day = currentDay();
  const nodesDone = day.nodes.every((_, i) => state.doneNodes[nodeKey(day.day, i)]) || state.doneDays[day.day];
  const rows = [
    ["知识/测验通过", state.nodeIndex > 1 || nodesDone, "卡片+测验证据"],
    ["实验自动测试", state.labRunning || nodesDone, "实验结果"],
    ["企业任务产出", Object.values(state.artifacts).filter(Boolean).length >= 2 || nodesDone, "交付物"],
    ["AI 初审", state.nodeIndex >= 4 || nodesDone, "初审意见"],
    ["动态数据隔离", true, "个性化案例数据"],
  ];
  const allPass = rows.every((r) => r[1]);
  state.evalPassed = allPass;
  saveState();
  tbody.innerHTML = rows
    .map(
      ([name, ok, evidence]) =>
        `<tr><td>${name}</td><td><span class="badge ${ok ? "ok" : "danger"}">${ok ? "通过" : "未通过"}</span></td><td>${evidence}</td></tr>`
    )
    .join("");
  if (toDefense) toDefense.disabled = !allPass;
}

function renderPortfolio() {
  const status = document.getElementById("portfolio-status");
  const verify = document.getElementById("verify-id");
  if (!status || !verify) return;
  if (state.reviewStatus === "pass" && state.verifyId) {
    verify.textContent = `核验号 ${state.verifyId}`;
    status.textContent = "证书绑定：提交、答辩、项目、导师评分（证据化认证）";
  } else {
    verify.textContent = "核验号 —";
    status.textContent = "通过日任务与项目验收后生成能力档案条目。";
  }
  const passportProgress = document.getElementById("passport-progress");
  const cert = document.getElementById("cert-status");
  const project = document.getElementById("passport-project");
  const prog = campProgress();
  if (passportProgress) passportProgress.textContent = `训练营进度 ${prog.done}/21 日 · 评测 ${state.evalPassed ? "通过" : "进行中"}`;
  if (cert) cert.textContent = state.reviewStatus === "pass" ? "已认证 · 平台能力证据链" : "训练中 · 非国家职业资格";
  if (project) project.textContent = `${currentDay().project} · Day ${currentDay().day}`;
}

function renderReview() {
  const queue = document.getElementById("review-queue");
  const evidence = document.getElementById("review-evidence");
  if (!queue || !evidence) return;
  if (state.reviewStatus === "pending") {
    queue.innerHTML = `<div class="card warn"><strong>待审</strong><p>Day ${currentDay().day} · ${currentDay().project}</p></div>`;
    evidence.innerHTML = `<li>自动测试 + AI 初审已就绪</li><li>帮助等级使用至 ${HELP_LEVELS[state.coachLevel].name}</li><li>小组贡献可追溯</li>`;
  } else if (state.reviewStatus === "pass") {
    queue.innerHTML = `<div class="card ok"><strong>已通过</strong><p>${state.verifyId}</p></div>`;
    evidence.innerHTML = `<li>${state.mentorComment}</li>`;
  } else {
    queue.innerHTML = `<p class="muted">日终提交后进入队列；导师看业务真实性与交付责任。</p>`;
    evidence.innerHTML = `<li>暂无提交</li>`;
  }
}

function renderOps() {
  const panel = document.getElementById("ops-panel");
  if (!panel) return;
  document.getElementById("ops-learners").textContent = state.paid ? "16" : "0";
  document.getElementById("ops-ttv").textContent = state.labRunning ? "当日上午" : "—";
  document.getElementById("ops-tickets").textContent = state.reviewStatus === "pending" ? "4" : "0";
  document.querySelectorAll("#ops-tabs a").forEach((a) => {
    a.setAttribute("aria-current", a.dataset.ops === state.opsTab ? "page" : "false");
  });
  const views = {
    cohort: `<h3>第 0 期验证班</h3><p>16 人 · 4 小组 · 21 天编排 V0.3 · 对齐报告 MVP 六模块</p>`,
    orders: `<h3>权益</h3><p>${state.paid ? "训练营席位有效（原型演示）" : "未开通"}</p><p class="muted">报告阶段 A/B：内容与任务闭环优先；复杂电商非第一阶段重点。</p>`,
    labs: `<h3>实验与差异化数据</h3><p>${state.labRunning ? "运行中" : "空闲"} · 每组收入/成本/异常不同</p>`,
    board: `<h3>教研健康度</h3><ul class="list"><li>知识单元版本与引用</li><li>高错误率节点</li><li>平均完成时间</li><li>LEVEL3 求助次数</li></ul>`,
  };
  panel.innerHTML = views[state.opsTab] || views.cohort;
}

function renderDiag() {
  const q = DIAG_QUESTIONS[state.diagStep];
  if (!q) return;
  document.getElementById("diag-q").textContent = q.q;
  document.getElementById("diag-progress").textContent = `进度 ${state.diagStep + 1} / ${DIAG_QUESTIONS.length}`;
  document.getElementById("diag-bar").style.width = `${((state.diagStep + 1) / DIAG_QUESTIONS.length) * 100}%`;
  const options = document.getElementById("diag-options");
  options.innerHTML = q.options
    .map(
      (opt, i) =>
        `<label class="card" style="cursor:pointer;display:flex;gap:8px"><input type="radio" name="diag" value="${i}" /><span>${opt}</span></label>`
    )
    .join("");
  document.getElementById("diag-next").disabled = true;
  options.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      document.getElementById("diag-next").disabled = false;
    });
  });
}

function render() {
  const id = currentScreenId();
  document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === id));
  document.querySelectorAll("#side-nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === id));
  const screen = SCREENS.find((s) => s.id === id);
  document.getElementById("path-hint").textContent = `当前：${screen?.name || id} · ${id.toUpperCase()}`;
  document.title = `${screen?.name || "原型"} · FDE Learning OS`;

  renderPills();
  renderDayCenter();
  renderOrchestration();
  renderLearnPage();
  renderProjectBoard();
  renderArtifacts();
  renderLab();
  renderCoach();
  renderEval();
  renderPortfolio();
  renderReview();
  renderOps();
  if (id === "s04" && !state.diagDone) renderDiag();
  saveState();
}

function ensurePaidAccess(id) {
  // 学习页不设门禁，方便直接预览阅读原型；其余学习交付页仍需演示开权
  const gated = ["s07", "s08", "s09", "s10", "s11", "s12", "s13", "s14"];
  if (gated.includes(id) && !state.paid) {
    toast("演示：请先点左侧「一键已付费」，或先打开「今日学习」");
    go("s-learn");
    return false;
  }
  return true;
}

function onHashChange() {
  if (!ensurePaidAccess(currentScreenId())) return;
  render();
}

function completeNode() {
  const day = currentDay();
  const key = nodeKey(day.day, state.nodeIndex);
  state.doneNodes[key] = true;

  if (state.nodeIndex < day.nodes.length - 1) {
    state.nodeIndex += 1;
    toast(`节点通过 → ${NODE_TYPES.find((n) => n.id === currentNode().type)?.label}`);
  } else {
    state.doneDays[day.day] = true;
    toast(`Day ${day.day} 通过，能力已更新`);
  }
  saveState();
  render();
}

function bindEvents() {
  document.body.addEventListener("click", (e) => {
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) {
      e.preventDefault();
      go(goBtn.dataset.go);
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;
    e.preventDefault();
    const action = actionBtn.dataset.action;

    if (action === "demo-reset") {
      state = defaultState();
      saveState();
      const chat = document.getElementById("coach-chat");
      if (chat) delete chat.dataset.seeded;
      const fc = document.getElementById("float-coach-chat");
      if (fc) fc.innerHTML = "";
      toast("已重置");
      go("s01");
      return;
    }

    if (action === "demo-jump-paid") {
      state.loggedIn = true;
      state.paid = true;
      state.profile = state.profile || { name: "演示学员" };
      state.coachOpen = false;
      state.learnTab = "card";
      state.nodeIndex = 0;
      saveState();
      toast("先进入「今日学习」阅读页");
      go("s-learn");
      return;
    }

    if (action === "open-learn") {
      state.nodeIndex = 0;
      state.learnTab = "card";
      saveState();
      toast("打开今日学习页");
      go("s-learn");
      return;
    }

    if (action === "learn-tab") {
      state.learnTab = actionBtn.dataset.tab || "card";
      saveState();
      if (currentScreenId() !== "s-learn") go("s-learn");
      else renderLearnPage();
      return;
    }

    if (action === "finish-reading") {
      const day = currentDay();
      state.doneNodes[nodeKey(day.day, 0)] = true;
      state.doneNodes[nodeKey(day.day, 1)] = true;
      state.nodeIndex = 2;
      state.learnTab = "quiz";
      saveState();
      toast("学习 + 测验已通过，实验已解锁");
      go("s08");
      return;
    }

    if (action === "go-lab-gated") {
      if (!learningCleared()) {
        toast("请先完成今日学习页");
        state.learnTab = "card";
        saveState();
        go("s-learn");
        return;
      }
      go("s10");
      return;
    }

    if (action === "go-project-gated") {
      if (!learningCleared()) {
        toast("请先完成今日学习，再进项目");
        state.learnTab = "card";
        saveState();
        go("s-learn");
        return;
      }
      go("s09");
      return;
    }

    if (action === "select-day") {
      const idx = Number(actionBtn.dataset.dayIndex);
      const day = CAMP_DAYS[idx];
      if (!day.unlocked) {
        toast("该日未解锁：完成前一日后才会下发新的学习包");
        return;
      }
      state.dayIndex = idx;
      state.nodeIndex = 0;
      state.learnTab = "card";
      const chat = document.getElementById("coach-chat");
      if (chat) delete chat.dataset.seeded;
      saveState();
      toast(`Day ${day.day}：打开学习页`);
      go("s-learn");
      return;
    }

    if (action === "select-node") {
      const idx = Number(actionBtn.dataset.nodeIndex);
      if (idx >= 2 && !learningCleared()) {
        toast("实验/项目仍锁定：先完成左侧学习");
        state.nodeIndex = state.doneNodes[nodeKey(currentDay().day, 0)] ? 1 : 0;
        saveState();
        render();
        return;
      }
      state.nodeIndex = idx;
      saveState();
      render();
      return;
    }

    if (action === "select-lab") {
      state.labSkillId = actionBtn.dataset.id;
      saveState();
      toast("已选用实验单元");
      render();
      return;
    }

    if (action === "select-ent") {
      state.enterpriseId = actionBtn.dataset.id;
      saveState();
      toast("已选用企业任务");
      render();
      return;
    }

    if (action === "open-coach" || action === "toggle-coach") {
      state.coachOpen = action === "toggle-coach" ? !state.coachOpen : true;
      saveState();
      renderCoach();
      return;
    }

    if (action === "close-coach") {
      state.coachOpen = false;
      saveState();
      renderCoach();
      return;
    }

    if (action === "coach-mode") {
      const mode = actionBtn.dataset.mode;
      if (!COACH_MODES[mode]) return;
      state.coachMode = mode;
      state.coachOpen = true;
      saveState();
      appendCoach(modeReply(mode, currentNode().title), "coach");
      toast(COACH_MODES[mode]);
      renderCoach();
      return;
    }

    if (action === "ask-coach-about-task") {
      state.coachMode = "process";
      state.coachOpen = true;
      saveState();
      appendCoach(modeReply("process", currentNode().title), "coach");
      go("s11");
      return;
    }

    if (action === "coach-escalate") {
      if (state.coachLevel >= 2) {
        toast("已是 LEVEL 3，已记入档案");
        return;
      }
      if (state.coachLevel === 1) {
        state.failCount += 1;
        if (state.failCount < 2) {
          toast("LEVEL 3 需多次失败并说明原因（再试一次申请）");
          saveState();
          return;
        }
      }
      state.coachLevel += 1;
      saveState();
      appendCoach(modeReply(state.coachMode, "升级帮助"), "coach");
      toast(`帮助等级 → ${HELP_LEVELS[state.coachLevel].name}`);
      renderCoach();
      return;
    }

    if (action === "start-enroll") {
      state.afterLogin = "s05";
      go(state.loggedIn ? "s05" : "s03");
      return;
    }

    if (action === "pay-success") {
      if (!state.loggedIn) {
        go("s03");
        return;
      }
      state.paid = true;
      saveState();
      go("s06");
      return;
    }

    if (action === "pay-fail") {
      toast("支付失败（演示）");
      return;
    }

    if (action === "complete-checkpoint") {
      completeNode();
      return;
    }

    if (action === "upload-artifacts") {
      ARTIFACTS.forEach((n, i) => {
        if (i <= state.nodeIndex + 1) state.artifacts[n] = true;
      });
      saveState();
      toast("已提交今日产出证据");
      render();
      return;
    }

    if (action === "start-lab") {
      state.labRunning = true;
      saveState();
      toast("交互实验已启动");
      render();
      return;
    }

    if (action === "reset-lab") {
      toast(state.labRunning ? "已重置快照" : "请先启动");
      renderLab();
      return;
    }

    if (action === "fix-fault") {
      state.faultFixed = true;
      state.artifacts["测试报告"] = true;
      saveState();
      toast("动态异常已处理");
      go("s13");
      return;
    }

    if (action === "rerun-eval") {
      renderEval();
      toast("已重跑");
      return;
    }

    if (action === "toggle-public") {
      if (state.reviewStatus !== "pass") {
        toast("需导师通过");
        return;
      }
      state.publicPortfolio = !state.publicPortfolio;
      saveState();
      render();
      return;
    }

    if (action === "copy-verify") {
      navigator.clipboard?.writeText(state.verifyId || "尚未生成").catch(() => {});
      toast(state.verifyId ? "已复制核验号" : "尚未生成");
    }
  });

  document.getElementById("login-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    state.loggedIn = true;
    state.profile = { name: e.target.name.value, city: e.target.city.value };
    saveState();
    go(state.afterLogin || "s05");
  });

  document.getElementById("send-code")?.addEventListener("click", () => {
    document.getElementById("code").value = "1234";
    toast("验证码 1234");
  });

  document.getElementById("diag-next")?.addEventListener("click", () => {
    if (state.diagStep < DIAG_QUESTIONS.length - 1) {
      state.diagStep += 1;
      saveState();
      renderDiag();
    } else {
      state.diagDone = true;
      saveState();
      go("s02");
    }
  });

  const bindCoachForm = (formId, inputId) => {
    document.getElementById(formId)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById(inputId);
      if (!input.reportValidity()) return;
      appendCoach(escapeHtml(input.value), "user");
      appendCoach(escapeHtml(modeReply(state.coachMode, input.value)), "coach");
      input.value = "";
    });
  };
  bindCoachForm("coach-form", "coach-input");
  bindCoachForm("float-coach-form", "float-coach-input");

  document.getElementById("defense-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    if (!state.evalPassed) {
      toast("请先通过作业评审");
      go("s13");
      return;
    }
    state.reviewStatus = "pending";
    state.artifacts["复盘文档"] = true;
    saveState();
    go("s17");
  });

  document.getElementById("review-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    if (state.reviewStatus !== "pending") {
      toast("无待审");
      return;
    }
    const decision = e.submitter?.value || "pass";
    state.mentorComment = e.target.comment.value.trim();
    state.reviewStatus = decision === "pass" ? "pass" : decision;
    if (decision === "pass") {
      state.verifyId = "FDE-LOS-2026-D03";
      state.publicPortfolio = true;
      state.doneDays[currentDay().day] = true;
      go("s15");
    } else go("s07");
    saveState();
    render();
  });

  document.getElementById("ops-tabs")?.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-ops]");
    if (!a) return;
    e.preventDefault();
    state.opsTab = a.dataset.ops;
    saveState();
    renderOps();
  });
}

function escapeHtml(str) {
  return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

buildNav();
bindEvents();
window.addEventListener("hashchange", onHashChange);
if (!location.hash) location.hash = "s01";
onHashChange();
