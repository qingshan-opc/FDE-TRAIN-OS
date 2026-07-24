const SCREENS = [
  { id: "s01", name: "官网首页", group: "获客转化" },
  { id: "s02", name: "城市班详情", group: "获客转化" },
  { id: "s03", name: "登录注册", group: "获客转化" },
  { id: "s04", name: "能力诊断", group: "获客转化" },
  { id: "s05", name: "支付确认", group: "获客转化" },
  { id: "s06", name: "支付成功", group: "获客转化" },
  { id: "s07", name: "课程中心", group: "学习交付" },
  { id: "s08", name: "课程任务地图", group: "学习交付" },
  { id: "s09", name: "项目交付室", group: "学习交付" },
  { id: "s10", name: "云端实验室", group: "实验室AI" },
  { id: "s11", name: "AI 教练工作台", group: "实验室AI" },
  { id: "s12", name: "动态故障", group: "实验室AI" },
  { id: "s13", name: "自动评测", group: "评测作品" },
  { id: "s14", name: "答辩复盘", group: "评测作品" },
  { id: "s15", name: "公开作品页", group: "评测作品" },
  { id: "s16", name: "能力护照", group: "评测作品" },
  { id: "s17", name: "导师审核台", group: "导师运营" },
  { id: "s18", name: "运营后台", group: "导师运营" },
];

/** 班内多课程：每课含小任务 + 复杂任务 */
const COURSES = [
  {
    id: "fullstack",
    title: "全栈认知与落地页",
    desc: "从页面到部署的最小闭环",
    module: "模块 1",
    tasks: [
      { id: "fs-html", type: "micro", name: "用语义化标签搭页面骨架", minutes: 25, pass: "结构可通过无障碍检查" },
      { id: "fs-css", type: "micro", name: "完成响应式布局", minutes: 35, pass: "375/768/1280 断点可用" },
      { id: "fs-form", type: "micro", name: "实现表单校验与提交态", minutes: 30, pass: "错误提示可访问" },
      {
        id: "fs-webpage",
        type: "complex",
        name: "做一个企业官网落地页",
        minutes: 240,
        pass: "可访问预览 + 基础 SEO + 移动端验收",
        checkpoints: ["信息架构", "视觉实现", "表单线索", "部署上线", "验收复盘"],
      },
    ],
  },
  {
    id: "ai-app",
    title: "AI 应用开发基础",
    desc: "把模型能力接到真实产品流程",
    module: "模块 2",
    tasks: [
      { id: "ai-prompt", type: "micro", name: "为业务场景写可测 Prompt", minutes: 30, pass: "3 组用例通过" },
      { id: "ai-api", type: "micro", name: "封装模型调用与超时重试", minutes: 40, pass: "失败可观测" },
      {
        id: "ai-assistant",
        type: "complex",
        name: "做一个客服辅助小应用",
        minutes: 300,
        pass: "对话、日志、人工接管齐全",
        checkpoints: ["需求边界", "接口联调", "安全过滤", "演示部署"],
      },
    ],
  },
  {
    id: "agent",
    title: "Agent 与工作流",
    desc: "工具调用、审批与人机边界",
    module: "模块 3",
    tasks: [
      { id: "ag-tool", type: "micro", name: "为 Agent 注册一个只读工具", minutes: 35, pass: "权限最小化" },
      { id: "ag-loop", type: "micro", name: "画清 Workflow vs Loop 选型", minutes: 25, pass: "能解释取舍" },
      {
        id: "ag-ops",
        type: "complex",
        name: "做一个带人工审批的运维 Agent",
        minutes: 360,
        pass: "高风险动作需审批",
        checkpoints: ["工具清单", "审批流", "审计日志", "故障演练"],
      },
    ],
  },
  {
    id: "rag",
    title: "RAG 企业知识助手",
    desc: "样板复杂项目：制造企业知识助手",
    module: "模块 4",
    tasks: [
      { id: "rag-chunk", type: "micro", name: "对比两种切分策略", minutes: 40, pass: "有 eval 对比表" },
      { id: "rag-eval", type: "micro", name: "搭一份固定检索 eval 集", minutes: 45, pass: "可重复跑分" },
      {
        id: "rag-deploy",
        type: "complex",
        name: "部署制造企业知识助手",
        minutes: 480,
        pass: "健康检查 + 权限 + 故障修复 + 答辩",
        checkpoints: ["需求澄清", "数据导入", "RAG 配置", "权限接入", "服务部署", "动态故障", "交付答辩"],
      },
    ],
  },
  {
    id: "solution",
    title: "企业方案与综合交付",
    desc: "方案写作、报价边界与客户沟通",
    module: "模块 5",
    tasks: [
      { id: "sol-brief", type: "micro", name: "把模糊需求写成验收标准", minutes: 30, pass: "5 条可测标准" },
      {
        id: "sol-pitch",
        type: "complex",
        name: "完成一次方案答辩演练",
        minutes: 180,
        pass: "AI 初评 + 导师抽检",
        checkpoints: ["现状调研", "架构选型", "风险清单", "口头答辩"],
      },
    ],
  },
];

const ARTIFACTS = ["需求确认单", "架构图", "运行地址", "测试报告", "权限矩阵", "复盘文档"];

const DIAG_QUESTIONS = [
  {
    q: "当 RAG 召回变差时，你首先会检查？",
    options: ["换更大模型", "检查切分与检索评估", "重写前端文案", "增加并发"],
    answer: 1,
  },
  {
    q: "客户说不清需求时，FDE 更应先做什么？",
    options: ["直接开工写 Agent", "用约束问题澄清边界与验收", "先买 GPU", "跳过权限设计"],
    answer: 1,
  },
  {
    q: "证书与作品页的核心价值是？",
    options: ["好看的完成徽章", "可核验的过程与运行证据", "视频完播证明", "分享朋友圈点赞"],
    answer: 1,
  },
];

const COACH_LEVELS = ["提问", "方向", "局部示例", "步骤"];
const COACH_MODES = {
  socratic: "苏格拉底",
  review: "代码审查",
  roleplay: "客户扮演",
  stuck: "卡住救援",
  plan: "任务拆解",
  retro: "评测复盘",
};

const STORAGE_KEY = "fde-mvp-proto-state-v2";

const defaultState = () => ({
  loggedIn: false,
  paid: false,
  profile: null,
  diagStep: 0,
  diagDone: false,
  courseId: "rag",
  taskId: "rag-deploy",
  checkpoint: 0,
  doneTasks: {},
  artifacts: Object.fromEntries(ARTIFACTS.map((a) => [a, false])),
  labRunning: false,
  faultFixed: false,
  coachLevel: 0,
  coachMode: "socratic",
  coachOpen: false,
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

function currentCourse() {
  return COURSES.find((c) => c.id === state.courseId) || COURSES[0];
}

function currentTask() {
  const course = currentCourse();
  return course.tasks.find((t) => t.id === state.taskId) || course.tasks[0];
}

function taskCheckpoints(task = currentTask()) {
  if (task.type === "complex" && task.checkpoints?.length) return task.checkpoints;
  return [task.name];
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
    ["实验室", state.labRunning],
    ["评测通过", state.evalPassed],
    ["教练开", state.coachOpen],
  ];
  host.innerHTML = pills
    .map(([label, on]) => `<span class="pill" data-on="${on}">${label}</span>`)
    .join("");
}

function courseProgress(course) {
  const done = course.tasks.filter((t) => state.doneTasks[t.id]).length;
  return { done, total: course.tasks.length, pct: Math.round((done / course.tasks.length) * 100) };
}

function overallProgress() {
  const all = COURSES.flatMap((c) => c.tasks);
  const done = all.filter((t) => state.doneTasks[t.id]).length;
  return { done, total: all.length, pct: Math.round((done / all.length) * 100) || 0 };
}

function renderCourses() {
  const grid = document.getElementById("course-grid");
  if (!grid) return;
  grid.innerHTML = COURSES.map((c) => {
    const p = courseProgress(c);
    const active = c.id === state.courseId;
    return `<article class="card course-card ${active ? "active" : ""}" data-action="select-course" data-course="${c.id}">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <span class="badge">${c.module}</span>
        <span class="muted">${p.done}/${p.total} 任务</span>
      </div>
      <h3 style="margin:8px 0 4px">${c.title}</h3>
      <p>${c.desc}</p>
      <p class="muted" style="margin-top:6px">
        小任务 ${c.tasks.filter((t) => t.type === "micro").length} ·
        复杂 ${c.tasks.filter((t) => t.type === "complex").length}
      </p>
      <div class="progress" style="margin-top:8px"><span style="width:${Math.max(p.pct, 6)}%"></span></div>
    </article>`;
  }).join("");
}

function renderTaskMaps() {
  const course = currentCourse();
  const task = currentTask();
  const title = document.getElementById("course-title");
  const desc = document.getElementById("course-desc");
  if (title) title.textContent = course.title;
  if (desc) desc.textContent = course.desc;

  const micro = document.getElementById("micro-task-list");
  const complex = document.getElementById("complex-task-list");
  if (micro) {
    micro.innerHTML = course.tasks
      .filter((t) => t.type === "micro")
      .map((t) => taskRowHtml(t))
      .join("");
  }
  if (complex) {
    complex.innerHTML = course.tasks
      .filter((t) => t.type === "complex")
      .map((t) => taskRowHtml(t))
      .join("");
  }

  const typeBadge = document.getElementById("task-type-badge");
  if (typeBadge) {
    typeBadge.className = `task-type ${task.type}`;
    typeBadge.textContent = task.type === "micro" ? "小任务" : "复杂任务";
  }

  const cps = taskCheckpoints(task);
  const idx = Math.min(state.checkpoint, cps.length - 1);
  document.getElementById("cp-detail-title").textContent = `${task.name}`;
  document.getElementById("cp-detail-list").innerHTML = `
    <li>类型：${task.type === "micro" ? "小任务" : "复杂任务（含检查点）"}</li>
    <li>预计：约 ${task.minutes} 分钟</li>
    <li>通过标准：${task.pass}</li>
    <li>当前步：${cps[idx]}（${idx + 1}/${cps.length}）</li>
    <li>AI 教练：全程可拆解 / 审查 / 角色扮演</li>`;

  const list = document.getElementById("checkpoint-list");
  if (list) {
    if (task.type === "complex") {
      list.innerHTML = `<h4 style="margin:0 0 6px">检查点</h4>` + cps.map((name, i) => {
        let status = "锁定";
        let cls = "";
        if (state.doneTasks[task.id] || i < state.checkpoint) status = "已通过";
        if (!state.doneTasks[task.id] && i === state.checkpoint) {
          status = "进行中";
          cls = "current";
        }
        return `<div class="checkpoint ${cls}"><span>${i + 1}. ${name}</span><span>${status}</span></div>`;
      }).join("");
    } else {
      list.innerHTML = `<p class="muted">小任务单步完成即可；也可让 AI 教练再拆成更小动作。</p>`;
    }
  }

  const badge = document.getElementById("cp-badge");
  if (badge) {
    const p = courseProgress(course);
    badge.textContent = `${p.done}/${p.total} 任务 · ${task.type === "complex" ? `检查点 ${Math.min(state.checkpoint + 1, cps.length)}/${cps.length}` : "小任务"}`;
  }

  const overall = overallProgress();
  const bar = document.getElementById("wb-progress");
  const text = document.getElementById("wb-progress-text");
  if (bar) bar.style.width = `${Math.max(overall.pct, 6)}%`;
  if (text) text.textContent = `班内课程进度 ${overall.done}/${overall.total}（${overall.pct}%）`;

  const next = document.getElementById("next-step-text");
  if (next) {
    if (state.doneTasks[task.id]) next.textContent = `当前任务已完成：${task.name}。可切换其他课程或去评测。`;
    else if (task.type === "complex") next.textContent = `继续《${course.title}》· ${task.name} · 检查点「${cps[idx]}」`;
    else next.textContent = `继续《${course.title}》· 小任务「${task.name}」`;
  }

  const note = document.getElementById("mentor-note");
  if (note) {
    if (state.reviewStatus === "pass") note.textContent = `导师通过：${state.mentorComment || "交付完整，可发布作品。"}`;
    else if (state.reviewStatus === "revise") note.textContent = `修改后通过：${state.mentorComment}`;
    else if (state.reviewStatus === "fail") note.textContent = `未通过：${state.mentorComment}`;
    else if (state.reviewStatus === "pending") note.textContent = "已提交，等待导师审核。";
    else note.textContent = "复杂任务结项后进入导师答辩；小任务由自动评测 + AI 教练反馈即可。";
  }
}

function taskRowHtml(t) {
  const done = !!state.doneTasks[t.id];
  const active = t.id === state.taskId;
  return `<div class="task-row">
    <span class="task-type ${t.type}">${t.type === "micro" ? "小" : "复杂"}</span>
    <div>
      <strong>${t.name}</strong>
      <p class="muted">${t.minutes} 分钟 · ${done ? "已完成" : active ? "进行中" : "未开始"}</p>
    </div>
    <button type="button" class="btn ${active ? "btn-primary" : ""}" data-action="select-task" data-task="${t.id}">
      ${done ? "回顾" : active ? "继续" : "开始"}
    </button>
  </div>`;
}

function renderArtifacts() {
  const grid = document.getElementById("artifact-grid");
  if (!grid) return;
  grid.innerHTML = ARTIFACTS.map((name) => {
    const done = state.artifacts[name];
    return `<article class="card ${done ? "ok" : ""}">
      <h4>${name}</h4>
      <p>${done ? "已上传" : "未上传 / 待更新"}</p>
    </article>`;
  }).join("");
}

function renderLab() {
  const status = document.getElementById("lab-status");
  if (!status) return;
  const task = currentTask();
  const nudge = document.getElementById("lab-coach-nudge");
  const ctx = document.getElementById("lab-coach-context");
  if (ctx) ctx.textContent = `看见：${currentCourse().title} / ${task.name} / 终端与 diff`;
  if (nudge) {
    nudge.textContent = state.labRunning
      ? "教练巡检：测试有失败项时，优先固定复现步骤，再改代码。"
      : "启动环境后，教练会盯着终端错误与验收标准主动提问。";
  }

  if (!state.labRunning) {
    status.textContent = "实例未启动";
    document.getElementById("lab-files").textContent = "点击「启动环境」后显示";
    document.getElementById("lab-editor").textContent = "# waiting for sandbox…";
    document.getElementById("lab-term").textContent = "$";
    document.getElementById("lab-preview").textContent = "未就绪";
    return;
  }

  status.textContent = "lab-user-8821 · 运行中 · 剩余 86 分钟";
  if (task.id === "fs-webpage" || state.courseId === "fullstack") {
    document.getElementById("lab-files").textContent = `index.html\nstyles.css\nscripts.js\nassets/`;
    document.getElementById("lab-editor").textContent = `<header class="hero">\n  <h1>Acme 智能制造</h1>\n  <!-- TODO: CTA + form -->\n</header>`;
    document.getElementById("lab-term").textContent = `$ npx serve .\nServing at http://localhost:3000`;
    document.getElementById("lab-preview").innerHTML = '<a href="#s10">落地页预览 · 200 OK</a>';
  } else {
    document.getElementById("lab-files").textContent = `app/\n  main.py\n  rag/\ndata/\ntests/`;
    document.getElementById("lab-editor").textContent = `def retrieve(query, k=5):\n    docs = index.search(query, top_k=k)\n    return rerank(docs)`;
    document.getElementById("lab-term").textContent = `$ pytest -q\n... 3 passed, 1 failed`;
    document.getElementById("lab-preview").innerHTML = '<a href="#s10">https://preview.local/lab-8821/health</a>';
  }
}

function seedCoachChat(force = false) {
  const chat = document.getElementById("coach-chat");
  if (!chat) return;
  if (chat.dataset.seeded && !force) return;
  const task = currentTask();
  chat.innerHTML = `
    <div class="bubble coach"><strong>教练</strong><br>当前在《${currentCourse().title}》的「${task.name}」。想先拆步骤、审代码，还是我来扮难搞的客户？</div>
    <div class="bubble user"><strong>你</strong><br>这个任务好大，不知道从哪开始。</div>
    <div class="bubble coach"><strong>教练（任务拆解）</strong><br>${planReply(task)}</div>`;
  chat.dataset.seeded = "1";
}

function renderCoach() {
  const levelEl = document.getElementById("coach-level");
  if (levelEl) levelEl.textContent = COACH_LEVELS[state.coachLevel];

  const list = document.getElementById("coach-context-list");
  if (list) {
    const task = currentTask();
    const cps = taskCheckpoints(task);
    list.innerHTML = `
      <li>课程：${currentCourse().title}</li>
      <li>任务：${task.name}（${task.type === "micro" ? "小任务" : "复杂任务"}）</li>
      <li>进度：检查点 ${Math.min(state.checkpoint + 1, cps.length)}/${cps.length}</li>
      <li>模式：${COACH_MODES[state.coachMode]} · 等级 ${COACH_LEVELS[state.coachLevel]}</li>
      <li>规则：默认不给完整项目代码；复杂任务可拆成小步</li>`;
  }

  document.querySelectorAll("#coach-mode-buttons [data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.mode === state.coachMode ? "true" : "false");
  });

  seedCoachChat();

  const panel = document.getElementById("float-coach");
  const fab = document.getElementById("coach-fab");
  if (panel) panel.classList.toggle("open", state.coachOpen);
  if (fab) {
    const learner = ["s07", "s08", "s09", "s10", "s11", "s12", "s13", "s14"].includes(currentScreenId());
    fab.style.display = state.paid && learner ? "flex" : "none";
  }

  const floatNudge = document.getElementById("float-coach-nudge");
  if (floatNudge) {
    floatNudge.textContent = `正在陪练：${currentTask().name} · 点模式可切换拆解/审查/客户/救援`;
  }
}

function planReply(task = currentTask()) {
  if (task.id === "fs-webpage" || task.name.includes("网页") || task.name.includes("落地页")) {
    return "先别做整站。拆成：①一屏信息架构 ②英雄区+CTA ③表单线索 ④移动端验收 ⑤部署预览。每步 30–60 分钟。";
  }
  if (task.type === "complex" && task.checkpoints) {
    return `复杂任务按检查点推进：${task.checkpoints.slice(0, 3).join(" → ")}… 每次只攻一个检查点。`;
  }
  return `小任务目标是「${task.pass}」。先写出完成定义，再动手 15 分钟，卡住就切「卡住救援」。`;
}

function modeReply(mode, text) {
  const task = currentTask();
  switch (mode) {
    case "review":
      return "审查视角：命名是否表达业务？错误路径有没有日志？有没有把密钥写进仓库？先改风险最高的一处。";
    case "roleplay":
      return "（客户）预算只有一半，下周就要上线演示。你们能不能先做个能看的版本？请用三句话说明取舍。";
    case "stuck":
      return `救援：离开屏幕 2 分钟，写清「期望 / 实际 / 已试过」。然后只验证与「${task.pass}」直接相关的那一步。`;
    case "plan":
      return planReply(task);
    case "retro":
      return "复盘：失败用例对应哪条假设？证据在日志还是 eval？下一次只改一个变量再跑。";
    default:
      return `先别要完整答案。围绕「${text.slice(0, 20)}」，你已经排除了哪些可能？`;
  }
}

function appendCoach(message, who = "coach", targetIds = ["coach-chat", "float-coach-chat"]) {
  targetIds.forEach((id) => {
    const chat = document.getElementById(id);
    if (!chat) return;
    const label = who === "user" ? "你" : `教练（${COACH_MODES[state.coachMode]}）`;
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

  const task = currentTask();
  const complexDone = task.type === "complex" && (state.doneTasks[task.id] || state.checkpoint >= taskCheckpoints(task).length - 1);
  const rows = [
    ["环境/预览可用", state.labRunning || task.type === "micro", "实验室或预览地址"],
    ["任务通过标准", !!state.doneTasks[task.id] || complexDone, task.pass],
    ["检索/功能 eval", state.courseId !== "rag" || state.faultFixed || task.type === "micro", state.faultFixed ? "回归通过" : "如适用"],
    ["故障修复（复杂任务）", task.type === "micro" || state.faultFixed || task.id !== "rag-deploy", state.faultFixed ? "已修复" : "待修复"],
    ["交付物完整性", Object.values(state.artifacts).filter(Boolean).length >= 2 || task.type === "micro", "关键文件"],
  ];

  const allPass = rows.every((r) => r[1]);
  state.evalPassed = allPass;
  saveState();

  tbody.innerHTML = rows
    .map(
      ([name, ok, evidence]) => `
      <tr>
        <td>${name}</td>
        <td><span class="badge ${ok ? "ok" : "danger"}">${ok ? "通过" : "未通过"}</span></td>
        <td>${evidence}</td>
      </tr>`
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
    status.textContent = state.publicPortfolio
      ? "公开可访问 · 多课程作品可挂到能力护照"
      : "已结项但设为私密";
  } else if (state.reviewStatus === "pending") {
    verify.textContent = "核验号 —";
    status.textContent = "审核中，通过后生成公开作品页。";
  } else {
    verify.textContent = "核验号 —";
    status.textContent = "完成任一复杂任务并答辩通过后可发布。";
  }

  const passportProgress = document.getElementById("passport-progress");
  const cert = document.getElementById("cert-status");
  const project = document.getElementById("passport-project");
  const overall = overallProgress();
  if (passportProgress) passportProgress.textContent = `课程任务 ${overall.done}/${overall.total} · 评测 ${state.evalPassed ? "通过" : "未通过"}`;
  if (cert) {
    cert.textContent =
      state.reviewStatus === "pass"
        ? "已颁发 · 培训结业 / 平台能力认证"
        : "进行中 · 培训结业 / 平台能力认证";
  }
  if (project) {
    project.textContent =
      state.reviewStatus === "pass"
        ? `${currentTask().name} — 已结项 · ${state.verifyId}`
        : `${currentCourse().title} / ${currentTask().name} — 进行中`;
  }
}

function renderReview() {
  const queue = document.getElementById("review-queue");
  const evidence = document.getElementById("review-evidence");
  if (!queue || !evidence) return;

  if (state.reviewStatus === "pending") {
    queue.innerHTML = `<div class="card warn"><strong>当前学员</strong><p>${currentTask().name} · 待审</p></div>`;
    evidence.innerHTML = `
      <li>课程：${currentCourse().title}</li>
      <li>任务类型：${currentTask().type}</li>
      <li>自动评测：${state.evalPassed ? "通过" : "未通过"}</li>
      <li>AI 轨迹：${COACH_MODES[state.coachMode]} / ${COACH_LEVELS[state.coachLevel]}</li>`;
  } else if (state.reviewStatus === "pass") {
    queue.innerHTML = `<div class="card ok"><strong>当前学员</strong><p>已通过</p></div>`;
    evidence.innerHTML = `<li>评语：${state.mentorComment}</li><li>作品：${state.verifyId}</li>`;
  } else if (state.reviewStatus === "revise" || state.reviewStatus === "fail") {
    queue.innerHTML = `<div class="card danger"><strong>当前学员</strong><p>${state.reviewStatus}</p></div>`;
    evidence.innerHTML = `<li>评语：${state.mentorComment}</li>`;
  } else {
    queue.innerHTML = `<p class="muted">暂无待审。复杂任务在 S14 提交后出现。</p>`;
    evidence.innerHTML = `<li>暂无提交</li>`;
  }
}

function renderOps() {
  const panel = document.getElementById("ops-panel");
  if (!panel) return;
  document.getElementById("ops-learners").textContent = state.paid ? "1" : "0";
  document.getElementById("ops-ttv").textContent = state.labRunning ? "1.2h" : "—";
  document.getElementById("ops-tickets").textContent = state.reviewStatus === "pending" ? "1" : "0";
  document.querySelectorAll("#ops-tabs a").forEach((a) => {
    a.setAttribute("aria-current", a.dataset.ops === state.opsTab ? "page" : "false");
  });
  const overall = overallProgress();
  const views = {
    cohort: `<h3>班次与课程包</h3><p>杭州第 1 期 · ${COURSES.length} 门课 · 学员进度 ${overall.pct}%</p>`,
    orders: `<h3>订单与权益</h3><p>${state.paid ? "已支付 · 解锁全部课程任务" : "暂无订单"}</p>`,
    labs: `<h3>实验室</h3><p>${state.labRunning ? "1 运行中" : "无实例"} · 按任务模板挂载镜像</p>`,
    board: `<h3>看板</h3><ul class="list">
      <li>课程完成：${overall.done}/${overall.total}</li>
      <li>AI 教练调用：演示中按模式计数</li>
      <li>复杂任务答辩：${state.reviewStatus}</li>
    </ul>`,
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
      (opt, i) => `
      <label class="card" style="cursor:pointer;display:flex;gap:8px;align-items:flex-start">
        <input type="radio" name="diag" value="${i}" />
        <span>${opt}</span>
      </label>`
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
  document.querySelectorAll(".screen").forEach((el) => {
    el.classList.toggle("active", el.id === id);
  });
  document.querySelectorAll("#side-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === id);
  });

  const screen = SCREENS.find((s) => s.id === id);
  document.getElementById("path-hint").textContent = `当前：${screen?.name || id} · ${id.toUpperCase()}`;
  document.title = `${screen?.name || "原型"} · FDE MVP`;

  renderPills();
  renderCourses();
  renderTaskMaps();
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
  const gated = ["s07", "s08", "s09", "s10", "s11", "s12", "s13", "s14"];
  if (gated.includes(id) && !state.paid) {
    toast("需先完成报名支付（或点「一键已付费」）");
    go(state.loggedIn ? "s05" : "s02");
    return false;
  }
  return true;
}

function onHashChange() {
  const id = currentScreenId();
  if (!ensurePaidAccess(id)) return;
  render();
}

function completeCurrentStep() {
  const task = currentTask();
  const cps = taskCheckpoints(task);

  if (task.type === "micro") {
    state.doneTasks[task.id] = true;
    state.checkpoint = 0;
    toast(`小任务完成：${task.name}`);
    saveState();
    render();
    return;
  }

  // complex: RAG fault gate on 动态故障 checkpoint
  if (task.id === "rag-deploy" && cps[state.checkpoint] === "动态故障" && !state.faultFixed) {
    toast("请先在动态故障页完成修复");
    go("s12");
    return;
  }

  if (state.checkpoint < cps.length - 1) {
    state.checkpoint += 1;
    toast(`检查点完成，进入：${cps[state.checkpoint]}`);
  } else {
    state.doneTasks[task.id] = true;
    state.checkpoint = cps.length;
    toast(`复杂任务完成：${task.name}`);
  }
  saveState();
  render();
}

function selectCourse(courseId) {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return;
  state.courseId = courseId;
  const next = course.tasks.find((t) => !state.doneTasks[t.id]) || course.tasks[0];
  state.taskId = next.id;
  state.checkpoint = 0;
  saveState();
  toast(`已进入课程：${course.title}`);
  go("s08");
}

function selectTask(taskId) {
  const course = currentCourse();
  const task = course.tasks.find((t) => t.id === taskId);
  if (!task) return;
  state.taskId = taskId;
  state.checkpoint = state.doneTasks[taskId] ? taskCheckpoints(task).length : 0;
  document.getElementById("coach-chat") && delete document.getElementById("coach-chat").dataset.seeded;
  saveState();
  toast(`当前任务：${task.name}`);
  render();
}

function setCoachMode(mode) {
  if (!COACH_MODES[mode]) return;
  state.coachMode = mode;
  state.coachOpen = true;
  saveState();
  const opener = modeReply(mode, currentTask().name);
  appendCoach(opener, "coach");
  toast(`教练模式：${COACH_MODES[mode]}`);
  renderCoach();
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
      document.getElementById("float-coach-chat").innerHTML = "";
      toast("演示状态已重置");
      go("s01");
      return;
    }

    if (action === "demo-jump-paid") {
      state.loggedIn = true;
      state.paid = true;
      state.profile = state.profile || { name: "演示学员", city: "杭州" };
      state.coachOpen = true;
      saveState();
      toast("已付费 · 进入课程中心");
      go("s07");
      return;
    }

    if (action === "select-course") {
      selectCourse(actionBtn.dataset.course);
      return;
    }

    if (action === "select-task") {
      selectTask(actionBtn.dataset.task);
      return;
    }

    if (action === "open-coach" || action === "toggle-coach") {
      state.coachOpen = action === "toggle-coach" ? !state.coachOpen : true;
      saveState();
      renderCoach();
      if (state.coachOpen) toast("AI 教练已打开");
      return;
    }

    if (action === "close-coach") {
      state.coachOpen = false;
      saveState();
      renderCoach();
      return;
    }

    if (action === "coach-mode") {
      setCoachMode(actionBtn.dataset.mode);
      return;
    }

    if (action === "ask-coach-about-task") {
      state.coachMode = "plan";
      state.coachOpen = true;
      saveState();
      appendCoach(planReply(), "coach");
      go("s11");
      return;
    }

    if (action === "start-enroll") {
      state.afterLogin = "s05";
      if (!state.loggedIn) {
        toast("请先登录");
        go("s03");
      } else go("s05");
      return;
    }

    if (action === "pay-success") {
      if (!state.loggedIn) {
        toast("请先登录");
        go("s03");
        return;
      }
      state.paid = true;
      saveState();
      toast("支付成功，已解锁课程库");
      go("s06");
      return;
    }

    if (action === "pay-fail") {
      toast("支付失败：可重试（演示）");
      return;
    }

    if (action === "complete-checkpoint") {
      completeCurrentStep();
      return;
    }

    if (action === "upload-artifacts") {
      ARTIFACTS.forEach((name, i) => {
        if (state.checkpoint > i || currentTask().type === "micro") state.artifacts[name] = true;
      });
      state.artifacts["需求确认单"] = true;
      saveState();
      toast("已模拟上传交付物");
      render();
      return;
    }

    if (action === "start-lab") {
      state.labRunning = true;
      saveState();
      toast("沙箱已启动");
      render();
      return;
    }

    if (action === "reset-lab") {
      if (!state.labRunning) {
        toast("请先启动环境");
        return;
      }
      toast("已重置到初始快照");
      renderLab();
      return;
    }

    if (action === "fix-fault") {
      state.faultFixed = true;
      if (currentTask().id === "rag-deploy") {
        const cps = taskCheckpoints();
        const idx = cps.indexOf("动态故障");
        if (idx >= 0) state.checkpoint = Math.max(state.checkpoint, idx + 1);
      }
      state.artifacts["测试报告"] = true;
      saveState();
      toast("故障已修复");
      go("s13");
      return;
    }

    if (action === "coach-escalate") {
      state.coachLevel = Math.min(state.coachLevel + 1, COACH_LEVELS.length - 1);
      saveState();
      appendCoach(`提示等级 → ${COACH_LEVELS[state.coachLevel]}：${modeReply(state.coachMode, "下一步")}`, "coach");
      toast(`提示等级 → ${COACH_LEVELS[state.coachLevel]}`);
      renderCoach();
      return;
    }

    if (action === "rerun-eval") {
      toast("已重跑评测");
      renderEval();
      return;
    }

    if (action === "toggle-public") {
      if (state.reviewStatus !== "pass") {
        toast("需导师通过后才能发布");
        return;
      }
      state.publicPortfolio = !state.publicPortfolio;
      saveState();
      toast(state.publicPortfolio ? "作品已公开" : "作品已设为私密");
      render();
      return;
    }

    if (action === "copy-verify") {
      const link = state.verifyId
        ? `${location.origin}${location.pathname}#s15?v=${state.verifyId}`
        : "尚未生成核验号";
      navigator.clipboard?.writeText(link).catch(() => {});
      toast(state.verifyId ? "核验链接已复制" : "尚未生成核验号");
    }
  });

  document.getElementById("login-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    state.loggedIn = true;
    state.profile = {
      name: form.name.value,
      city: form.city.value,
      stage: form.stage.value,
      goal: form.goal.value,
      phone: form.phone.value,
    };
    saveState();
    toast(`欢迎，${state.profile.name}`);
    go(state.afterLogin || "s05");
  });

  document.getElementById("send-code")?.addEventListener("click", () => {
    document.getElementById("code-hint").textContent = "验证码已发送（演示）：1234";
    document.getElementById("code").value = "1234";
    toast("演示验证码：1234");
  });

  document.getElementById("diag-next")?.addEventListener("click", () => {
    const selected = document.querySelector('input[name="diag"]:checked');
    if (!selected) return;
    if (state.diagStep < DIAG_QUESTIONS.length - 1) {
      state.diagStep += 1;
      saveState();
      renderDiag();
    } else {
      state.diagDone = true;
      saveState();
      toast("诊断完成：建议从「全栈落地页」或「RAG 助手」开练");
      go("s02");
    }
  });

  const onCoachSubmit = (formId, inputId) => {
    document.getElementById(formId)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById(inputId);
      if (!input.reportValidity()) return;
      appendCoach(escapeHtml(input.value), "user");
      appendCoach(escapeHtml(modeReply(state.coachMode, input.value)), "coach");
      input.value = "";
    });
  };
  onCoachSubmit("coach-form", "coach-input");
  onCoachSubmit("float-coach-form", "float-coach-input");

  document.getElementById("defense-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    if (!state.evalPassed) {
      toast("请先通过自动评测");
      go("s13");
      return;
    }
    state.reviewStatus = "pending";
    state.artifacts["复盘文档"] = true;
    saveState();
    toast("已提交导师审核");
    go("s17");
  });

  document.getElementById("review-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    if (state.reviewStatus !== "pending") {
      toast("当前没有待审提交");
      return;
    }
    const decision = e.submitter?.value || "pass";
    state.mentorComment = form.comment.value.trim();
    state.reviewStatus = decision === "pass" ? "pass" : decision;
    if (decision === "pass") {
      state.verifyId = "FDE-2026-0812";
      state.publicPortfolio = true;
      state.doneTasks[currentTask().id] = true;
      toast("审核通过，作品页已生成");
      go("s15");
    } else if (decision === "revise") {
      toast("已要求修改后通过");
      go("s07");
    } else {
      toast("已标记不通过");
      go("s07");
    }
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
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

buildNav();
bindEvents();
window.addEventListener("hashchange", onHashChange);
if (!location.hash) location.hash = "s01";
onHashChange();
