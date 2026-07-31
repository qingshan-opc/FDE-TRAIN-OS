"""AgentGateway — enqueue to PG worker queue; SSE from job_events."""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

import yaml
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

_PKG_ROOT = Path(__file__).resolve().parents[2]
if str(_PKG_ROOT) not in sys.path:
    sys.path.insert(0, str(_PKG_ROOT))
from services.shared.config import ROOT as _ROOT  # noqa: E402

from services.domain import jobs as queue  # noqa: E402
from services.shared import (  # noqa: E402
    AGENT_MODE,
    ANYCODE_DASHBOARD_URL,
    CONTRACTS_DIR,
    CONTRACTS_UPLOAD_DIR,
    WORKSPACE_MAX_BYTES,
    db_cursor,
    init_schema,
    now_iso,
    resolve_safe,
    workspace_path,
    workspace_size_bytes,
    write_audit,
)
from services.shared.anycode_client import anycode_healthy  # noqa: E402
from services.shared.middleware import require_user, session_camp_id, session_learner_id  # noqa: E402
from services.shared.rubric_registry import enrich_eval_result  # noqa: E402
from services.shared.command_evidence import try_read_command_stats_from_workspace  # noqa: E402
from services.storage import get_store, hydrate_workspace, snapshot_prefix, snapshot_workspace, temp_workspace  # noqa: E402
from services.shared.config import S3_BUCKET_WORKSPACES, S3_PRESIGN_GET_EXPIRES  # noqa: E402

router = APIRouter(tags=["agent"])
app = FastAPI(title="FDE AgentGateway", version="0.4.0")
init_schema()

SYSTEM_PREFIX = (
    "你是 FDE 训练营学员工作区助手。只在当前项目根目录读写文件；"
    "禁止建议或执行 Docker/K8s/云主机部署；完成任务后给出产物路径。"
)
DENY_PATTERNS = ("rm -rf /", "docker ", "kubectl ", "mkfs", ":(){", "shutdown", "reboot")


class EnsureWorkspace(BaseModel):
    camp_id: str | None = None


class CreateJob(BaseModel):
    prompt: str
    node_id: str | None = None
    force_stub: bool = False
    camp_id: str | None = None
    skills: list[str] | None = None
    # ignored — kept for backward compat with old clients
    learner_id: str | None = None


class EvaluateBody(BaseModel):
    rubric: list[dict[str, Any]] = Field(default_factory=list)


def _anycode_up() -> bool:
    return anycode_healthy()


def _resolve_runner(force_stub: bool) -> str:
    if force_stub or AGENT_MODE == "stub":
        return "stub"
    if AGENT_MODE == "live":
        if not _anycode_up():
            raise HTTPException(503, "AGENT_MODE=live but anyCode Workbench unreachable")
        return "anycode"
    return "anycode" if _anycode_up() else "stub"


def _guard_prompt(prompt: str) -> None:
    low = prompt.lower()
    for p in DENY_PATTERNS:
        if p.lower() in low:
            raise HTTPException(400, f"prompt denied: contains `{p.strip()}`")


def _stub_write(ws: Path, prompt: str) -> dict[str, Any]:
    """Write demo artifacts matching day rubric paths when possible."""
    low = prompt.lower()
    files: list[str] = []

    def html(title: str, body: str, name: str) -> str:
        (ws / name).write_text(
            f"""<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>{title}</title>
<style>body{{font-family:system-ui;margin:2rem;line-height:1.5}} code,pre{{background:#f4f4f4;padding:.2rem .4rem}} .card{{display:inline-block;border:1px solid #ddd;padding:1rem;margin:.4rem;min-width:8rem}}</style>
</head><body>{body}</body></html>""",
            encoding="utf-8",
        )
        return name

    if "theory-map" in low:
        # v07 Day5 理论收束：个人全栈理论地图（rubric: 云原生/前端/后端）
        (ws / "theory-map.md").write_text(
            """# 个人全栈理论地图 · 部门周报助手

## 世界观
1. 六次浪潮每次重排「谁变贵」——实例：Day 1 我用 PM 提示词定方向而不是手写 PRD。
2. 「写」变便宜，定方向与做验收变贵——实例：每天的 Rubric 过闸。
3. FDE = 离业务最近的全栈交付工程师——实例：五天从需求走到接口设计。

## 开发流程
1. 六站：需求调研→原型确认→开发→测试验收→上线→迭代——实例：Day 1 PRD 就是调研产出。
2. 敏捷 = 一周装修一间房——实例：每天一个小交付、每天一次验收。
3. 访谈问「上一次」，不问「好不好」——类比：看食堂倒掉什么。

## 服务器与云原生
1. 服务器 = 一直开着、没屏幕、住机房的电脑——实例：周报助手合盖就没，必须上云。
2. 演进五站：物理机→虚拟机→容器→K8s→Serverless——类比：从买车到打车。
3. 云原生 = 生下来就住在云上的应用——小工具先一台云主机起步，不为三箱货建深水港。

## 命令行
1. 命令行 = 用文字和电脑对话——实例：仿真终端敲出 8 个命令。
2. 排障四步：curl 敲门 → tail -f 看日志 → docker ps 看容器 → df/top 看资源。
3. 八句起步：pwd / ls / mkdir / cd / curl / tail / chmod / docker ps——敲一遍顶看十遍。

## 前端选型
1. 前端 = 用户直接接触的界面层：Web / App / 小程序 / 桌面——实例：Day 3 的 index.html 是 Web 支。
2. 两步选型法：先定平台，再选框架（四问：团队/生态/AI/项目大小）。
3. 框架是项目长大了才需要的装备——小项目不用框架就是正确答案。

## 后端选型
1. 后端三件事：业务逻辑、数据、接口——实例：Day 4 的餐厅后厨类比。
2. AI 项目首选 Python + FastAPI（自带 OpenAPI）——实例：API_Spec.md 与 FastAPI 天生一对。
3. 场景决定数据库：原型 SQLite、主库 PostgreSQL、缓存 Redis、分析 ClickHouse。
4. 契约是合同，语言只是施工队——实例：API_Spec.md 先于任何语言定稿。
""",
            encoding="utf-8",
        )
        files.append("theory-map.md")
        primary = "theory-map.md"
    elif "api_spec" in low:
        # v07 Day4 后端设计：API 契约 + 数据库设计（rubric: GET / 主键）
        (ws / "API_Spec.md").write_text(
            """# API 定义 · 部门周报助手（OpenAPI 3.0 摘要）

Base URL: `http://localhost:8000` · 认证: JWT Bearer

## 接口列表

### GET /reports?dept_id=&week=
获取某部门某周周报。200: `{id, dept, week, summary, metrics[]}`；404: 周报不存在；500: 服务异常。

### POST /reports
触发周报生成。Body: `{dept_id, week}`；201: `{id, status}`；400: 参数缺失；401: 未认证。

### GET /metrics?dept_id=&range=7d
获取指标明细。200: `{metrics[]}`；400: range 非法。
""",
            encoding="utf-8",
        )
        (ws / "DB_Schema.md").write_text(
            """# 数据库设计 · 部门周报助手

## users 表
| 列 | 类型 | 约束 |
|----|------|------|
| id | SERIAL | 主键 |
| name | VARCHAR(64) | NOT NULL |
| dept_id | INT | 外键 → depts.id |

## reports 表
| 列 | 类型 | 约束 |
|----|------|------|
| id | SERIAL | 主键 |
| dept_id | INT | 外键 → depts.id |
| week | VARCHAR(8) | NOT NULL |
| summary | TEXT | |

索引建议：`reports(dept_id, week)` 联合索引（按部门查周报最快）。
""",
            encoding="utf-8",
        )
        files.extend(["API_Spec.md", "DB_Schema.md"])
        primary = "API_Spec.md"
    elif "高保真" in prompt or "hero" in low:
        # v07 Day3 前端原型：高保真单页（rubric: <html / hover）
        (ws / "index.html").write_text(
            """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>部门周报助手</title>
<style>
body{font-family:system-ui;margin:0;color:#1a2332}
.hero{padding:4rem 2rem;background:linear-gradient(135deg,#0f2a43,#1b4a6b);color:#fff}
.hero h1{font-size:2.5rem;margin:0 0 .5rem}
.btn{display:inline-block;background:#2dd4bf;color:#06281f;padding:.8rem 1.6rem;border-radius:.6rem;border:0;font-size:1rem;cursor:pointer}
.btn:hover{background:#5eead4}
.btn:disabled{opacity:.4;cursor:not-allowed}
.cards{display:flex;gap:1rem;padding:2rem}
.card{flex:1;border:1px solid #e2e8f0;border-radius:.8rem;padding:1.2rem}
.card:hover{border-color:#2dd4bf}
</style></head>
<body>
<section class="hero"><h1>部门周报助手</h1><p>每周五下午 4 点，周报已经写好了。</p>
<button class="btn" type="button">立即体验</button> <button class="btn" type="button" disabled>企业版（即将上线）</button></section>
<section class="cards">
<div class="card"><h3>自动汇总</h3><p>订单、工单、库存数据一屏看齐。</p></div>
<div class="card"><h3>AI 摘要</h3><p>一句话说清本周最该盯的事。</p></div>
<div class="card"><h3>一键导出</h3><p>Markdown / PDF 直接发给负责人。</p></div>
</section>
</body></html>""",
            encoding="utf-8",
        )
        (ws / "README.md").write_text(
            "# 部门周报助手 · 高保真原型\n\n- `index.html` — 单页原型：hero + 三功能区块，含 hover / disabled 状态。\n",
            encoding="utf-8",
        )
        files.extend(["index.html", "README.md"])
        primary = "index.html"
    elif "architecture.md" in low:
        # v07 Day2 架构设计：风格选择 + ADR（rubric: ADR / 理由）
        (ws / "architecture.md").write_text(
            """# 架构设计 · 部门周报助手

## 架构风格选择
选择：模块化单体。理由：3 人团队、内部工具、日活 < 500——微服务的分布式代价远超收益。
否决方案：微服务（运维成本高，否决）、Serverless（定时汇总任务有冷启动，保留观察）。

## 四层分层
前端层（React 单页）→ 接口层（REST / FastAPI）→ 数据层（PostgreSQL）→ 模型层（周报摘要，经网关调用）。

## ADR-001 采用模块化单体
- 背景：小团队、需求变化快。
- 决策：单体 + 模块边界（reports / metrics / summary）。
- 理由：部署一个进程即可，拆服务信号 = 团队超过 8 人或单模块 QPS > 100。
- 后果：迭代快；代价是模块边界要靠评审守住。

## ADR-002 PostgreSQL 作为主库
- 背景：结构化周报数据、需要复杂查询。
- 决策：PostgreSQL。理由：团队熟悉、JSONB 可存半结构化指标。
- 后果：写模型输出到 JSONB 无需改表。

## ADR-003 模型调用走网关
- 背景：摘要模型可能更换。
- 决策：所有模型调用经内部网关。理由：换模型 = 换配置。
- 后果：多一跳延迟（<50ms 可接受）。
""",
            encoding="utf-8",
        )
        files.append("architecture.md")
        primary = "architecture.md"
    elif "prd.md" in low:
        # v07 Day1 迷你 PRD（rubric: 用户故事 / 验收标准）
        (ws / "PRD.md").write_text(
            """# PRD · 部门周报助手（迷你版）

## 1. 产品概述
部门周报助手：自动汇总部门一周数据并生成周报草稿，让负责人每周节省 2 小时。

## 2. 目标用户与平台
- 用户：部门负责人（周读）、团队成员（周填）。
- 目标平台：Web（桌面端优先）。

## 3. 用户故事
1. 作为部门负责人，我想要自动汇总本周指标，以便不再手动收数。
2. 作为部门负责人，我想要 AI 生成一句话摘要，以便 30 秒看懂重点。
3. 作为团队成员，我想要异常项自动高亮，以便提前处理风险。

## 4. 验收标准
- 故事 1：打开页面 3 秒内展示本周全部核心指标卡。
- 故事 2：摘要不超过 60 字且包含至少 1 个具体数字。
- 故事 3：超阈值指标以警示色高亮，并可点击查看明细。
""",
            encoding="utf-8",
        )
        (ws / "README.md").write_text(
            "# 部门周报助手 · 工作区\n\n- `PRD.md` — 迷你产品需求文档（Day 1 交付物）\n- `index.html` — 产品愿景预览页\n",
            encoding="utf-8",
        )
        (ws / "index.html").write_text(
            """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>部门周报助手</title>
<style>body{font-family:system-ui;margin:2rem;line-height:1.6}.badge{background:#2dd4bf;padding:.2rem .6rem;border-radius:1rem}</style>
</head><body><h1>部门周报助手</h1>
<p><span class="badge">每周节省 2 小时</span></p>
<ul><li>自动汇总本周指标</li><li>AI 一句话摘要</li><li>异常项自动高亮</li></ul>
</body></html>""",
            encoding="utf-8",
        )
        files.extend(["PRD.md", "README.md", "index.html"])
        primary = "PRD.md"
    elif "direction-card" in low or "方向卡" in prompt or "wireframe" in low:
        # v06 Day1 实战：方向卡 + 驾驶舱线框（rubric: 两文件存在 + 关键字段）
        (ws / "direction-card.md").write_text(
            """# 方向卡 · 运营驾驶舱（示例稿）

## 一句话价值主张
让部门负责人每天早上 3 分钟看清「昨天发生了什么、今天该盯什么」。

## 业务问题
1. 业务问题一：昨天订单量与转化率环比如何？（数据来源：订单系统日报 → 决策用途：是否启动促销预案）
2. 业务问题二：异常工单数量与分布？（数据来源：工单系统 → 决策用途：是否加派人手）
3. 业务问题三：库存预警 SKU 数？（数据来源：WMS → 决策用途：是否触发补货）

> 每个问题均可数据化、有明确数据来源与决策用途。
""",
            encoding="utf-8",
        )
        (ws / "wireframe.md").write_text(
            """# 驾驶舱五区块线框（V0.1 草稿）

1. 标题区：部门 + 日期 + 数据刷新时间。
2. 指标卡区（回答问题 1）：订单量、转化率、环比箭头；三态：加载中骨架屏 / 成功数值 / 失败错误条。
3. 趋势图区（回答问题 1）：近 14 天订单量折线；三态：加载中 / 成功折线 / 空数据占位。
4. 明细表区（回答问题 2、3）：异常工单 + 预警 SKU 表；三态：加载中 / 成功表格 / 空态文案。
5. AI 摘要占位区：一句话昨日总结；三态：生成中 / 成功文本 / 降级为规则模板。

## Prompt 草稿（四要素）
- 角色：资深前端工程师
- 任务：按上述五区块生成单文件驾驶舱 index.html（模拟数据）
- 约束：每区块含指标卡数值与三态占位；不请求外部接口
- 格式：单 HTML 文件，内联样式与脚本
""",
            encoding="utf-8",
        )
        files.extend(["direction-card.md", "wireframe.md"])
        primary = "direction-card.md"
    elif "schema.sql" in low or "CREATE TABLE products" in prompt or ("products" in low and "ddl" in low) or "db-notes" in low:
        primary = "schema.sql"
        (ws / primary).write_text(
            """CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  qty INT NOT NULL DEFAULT 0,
  warn_qty INT NOT NULL DEFAULT 10
);
INSERT INTO products (sku, name, qty, warn_qty) VALUES
 ('A-100','办公用纸',120,50),
 ('B-200','硒鼓',18,20),
 ('C-300','网线',80,30);
""",
            encoding="utf-8",
        )
        html("库表说明", "<h1>关系型库说明</h1><p>库存主数据用关系型表 products 管理。</p>", "db-notes.html")
        files.extend(["schema.sql", "db-notes.html"])
    elif "api.html" in low or "/api/inventory/inbound" in low or ("入库 API" in prompt):
        primary = html(
            "入库 API",
            '<h1>入库 API</h1><p>路径 <code>/api/inventory/inbound</code> · 方法 <strong>POST</strong></p><pre>{"sku":"A-100","qty":10,"warehouse":"WH-01"}</pre>',
            "api.html",
        )
        files.append(primary)
    elif "inventory.html" in low or ("刷新数据" in prompt and "SKU" in prompt):
        primary = "inventory.html"
        (ws / primary).write_text(
            """<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>库存联调</title>
<style>body{font-family:system-ui;margin:2rem} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:.5rem}</style>
</head><body><h1>库存列表联调</h1>
<button id="refresh" type="button">刷新数据</button>
<table><thead><tr><th>SKU</th><th>名称</th><th>库存</th></tr></thead><tbody id="tb"></tbody></table>
<form id="lead"><input placeholder="线索姓名"/><button type="submit">提交</button></form>
<script>
const mock=[{sku:'A-100',name:'办公用纸',qty:120},{sku:'B-200',name:'硒鼓',qty:18},{sku:'C-300',name:'网线',qty:80}];
function render(){document.getElementById('tb').innerHTML=mock.map(r=>`<tr><td>${r.sku}</td><td>${r.name}</td><td>${r.qty}</td></tr>`).join('')}
document.getElementById('refresh').onclick=render; render();
</script></body></html>""",
            encoding="utf-8",
        )
        files.append(primary)
    elif "prompt-playbook" in low or "Prompt 指挥手册" in prompt:
        primary = html(
            "Prompt 指挥手册",
            "<h1>Prompt 指挥手册</h1><p>公式：<strong>角色+背景+任务+约束</strong></p>",
            "prompt-playbook.html",
        )
        files.append(primary)
    elif "agent-layers" in low or ("Scaffolding" in prompt and "Harness" in prompt):
        primary = html("Agent Runtime", "<h1>Agent Runtime</h1><p>Agent = Model + Scaffolding + Harness</p>", "agent-layers.html")
        files.append(primary)
    elif "cs-bot" in low or ("智能客服" in prompt and "RAG" in prompt):
        primary = html("智能客服", '<h1>智能客服</h1><section id="faq"><p>基于 RAG</p></section>', "cs-bot.html")
        files.append(primary)
    elif "cockpit" in low or "经营驾驶舱" in prompt:
        primary = html(
            "经营驾驶舱",
            '<h1>经营驾驶舱</h1>'
            '<div class="card">销售 128万</div>'
            '<div class="card">订单 860</div>'
            '<div class="card">库存 12万</div>'
            '<div class="card">利润 36万</div>'
            '<p><input placeholder="问问 AI" /></p>',
            "cockpit.html",
        )
        files.append(primary)
    elif "workflow" in low or ("check_inventory" in low and "send_email" in low):
        primary = html("库存助理", "<h1>库存助理</h1><ol><li>check_inventory</li><li>send_email</li></ol>", "workflow.html")
        files.append(primary)
    elif "delivery-pack" in low or ("企业交付包" in prompt and "私有化" in prompt):
        primary = html(
            "企业交付包",
            "<h1>企业交付包</h1><h2>上线 SOP</h2><ol><li>关闭 Debug</li><li>检查端口</li><li>确认数据库</li></ol>"
            "<h2>架构图清单</h2><ul><li>业务架构</li><li>部署架构</li></ul>"
            "<p>避坑：注入 / Token / 延迟。支持私有化部署。</p>",
            "delivery-pack.html",
        )
        files.append(primary)
    elif "rag-faq" in low or ("FAQ" in prompt and "RAG" in prompt):
        primary = html("库存 FAQ", '<h1>库存 FAQ</h1><section id="faq"></section>', "rag-faq.html")
        files.append(primary)
    elif "线索落地" in prompt or "线索" in prompt or "lead form" in low or "落地页" in prompt:
        primary = html("线索落地页", '<h1>获取产品演示</h1><form id="lead"><button class="cta" type="submit">提交线索</button></form>', "index.html")
        files.append(primary)
    else:
        primary = "index.html"
        (ws / "styles.css").write_text(
            """:root {
  --bg: #f7f8f9;
  --card: #ffffff;
  --ink: #134e4a;
  --muted: #6b7280;
  --accent: #0d9488;
  --danger: #dc2626;
  --border: #e5e7eb;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, "PingFang SC", system-ui, sans-serif;
  background: var(--bg);
  color: #1f2937;
  line-height: 1.5;
}
.wrap { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
h1 { margin: 0; color: var(--ink); font-size: 1.5rem; }
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
button {
  background: var(--accent);
  color: #fff;
  border: 0;
  border-radius: 8px;
  padding: .55rem 1rem;
  font-weight: 600;
  cursor: pointer;
}
button:hover { filter: brightness(.95); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .7rem .6rem; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-size: .85rem; font-weight: 600; }
tr.warn td { background: #fef2f2; }
.badge {
  display: inline-block;
  padding: .15rem .5rem;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 600;
  background: #fee2e2;
  color: var(--danger);
}
.muted { color: var(--muted); font-size: .9rem; }
@media (max-width: 640px) {
  header { flex-direction: column; align-items: flex-start; }
}
""",
            encoding="utf-8",
        )
        (ws / "app.js").write_text(
            """const DATA = [
  { sku: "A-100", name: "办公用纸", qty: 120, warn: 50 },
  { sku: "B-200", name: "硒鼓", qty: 18, warn: 20 },
  { sku: "C-300", name: "网线", qty: 80, warn: 30 },
];

function render() {
  const tb = document.getElementById("tb");
  if (!tb) return;
  tb.innerHTML = DATA.map((r) => {
    const low = r.qty < r.warn;
    return `<tr class="${low ? "warn" : ""}">
      <td>${r.sku}</td>
      <td>${r.name}</td>
      <td>${r.qty}</td>
      <td>${r.warn}</td>
      <td>${low ? '<span class="badge">低库存</span>' : "正常"}</td>
    </tr>`;
  }).join("");
  const tip = document.getElementById("tip");
  if (tip) {
    const lows = DATA.filter((r) => r.qty < r.warn).map((r) => r.sku);
    tip.textContent = lows.length
      ? `预警：${lows.join(", ")} 库存低于警戒线`
      : "全部 SKU 库存正常";
  }
}

document.getElementById("refresh")?.addEventListener("click", render);
render();
""",
            encoding="utf-8",
        )
        (ws / primary).write_text(
            """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>库存列表</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>库存列表</h1>
        <p class="muted" id="tip">加载中…</p>
      </div>
      <button id="refresh" type="button">刷新数据</button>
    </header>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>名称</th>
            <th>库存</th>
            <th>警戒线</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody id="tb"></tbody>
      </table>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
""",
            encoding="utf-8",
        )
        (ws / "README.md").write_text(
            """# 企业库存管理系统 · Day1

## 产物

- `index.html` — 库存列表页（含 SKU / 名称 / 库存 / 警戒线）
- `styles.css` — 页面样式
- `app.js` — 示例数据与刷新交互

## 说明

B-200（硒鼓）库存低于警戒线，用于讲解预警场景。本演示不依赖 Docker / Kubernetes。
""",
            encoding="utf-8",
        )
        files.extend([primary, "styles.css", "app.js", "README.md"])

    if not (ws / "README.md").exists():
        (ws / "README.md").write_text("# 学员工作区\n", encoding="utf-8")
    if "README.md" not in files:
        files.append("README.md")
    return {"files": files, "primary": primary}


def _job_row(job_id: str) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute("SELECT * FROM agent_jobs WHERE id=?", (job_id,))
        row = cur.fetchone()
        if not row:
            # fall back to jobs table
            j = queue.get_job(job_id)
            if not j:
                raise HTTPException(404, "job not found")
            return j
        return dict(row)


def _evaluate_workspace(ws: Path, rubric: list[dict[str, Any]]) -> dict[str, Any]:
    checks = []
    for rule in rubric:
        cid = rule.get("check", "")
        args = rule.get("args") or {}
        ok, detail = False, ""
        try:
            if cid == "file_exists":
                p = resolve_safe(ws, args.get("path", "index.html"))
                ok = p.is_file()
                detail = f"{args.get('path')} exists={ok}"
            elif cid == "text_contains":
                p = resolve_safe(ws, args.get("path", "index.html"))
                needle = args.get("needle", "")
                text = p.read_text(encoding="utf-8") if p.is_file() else ""
                ok = needle.lower() in text.lower()
                detail = f"contains {needle!r}: {ok}"
            else:
                detail = f"unknown check {cid}"
        except Exception as exc:
            detail = str(exc)
        checks.append({"id": cid, "ok": ok, "detail": detail, "args": args})
    passed = all(c["ok"] for c in checks) if checks else False
    result = {"pass": passed, "checks": checks, "score": sum(1 for c in checks if c["ok"]) / max(len(checks), 1)}
    stats = try_read_command_stats_from_workspace(ws)
    if stats:
        result["command_stats"] = stats
    return enrich_eval_result(result)


def _load_lab_files_meta(camp_id: str, day: int | None, learner_id: str | None = None) -> dict[str, Any]:
    """Best-effort: `workspace_mode` / `primary_files` / `inherited_files`
    declared under a day's `lab` block (workspace day-view). Tries the
    DB-backed package first (domain v2 dual-read), then falls back to the
    YAML contract. Returns ``{}`` if nothing is resolvable so callers degrade
    to an untagged/flat file list — this must never raise."""
    if day is None:
        return {}
    try:
        from services.application.course_runtime import get_day_data

        res = get_day_data(camp_id, day, learner_id=learner_id)
        if res:
            data, _src = res
            lab = data.get("lab") or {}
            if lab.get("primary_files") or lab.get("inherited_files"):
                return {
                    "primary_files": list(lab.get("primary_files") or []),
                    "inherited_files": list(lab.get("inherited_files") or []),
                    "workspace_mode": lab.get("workspace_mode"),
                }
    except Exception:
        pass
    try:
        name = f"day-{int(day):02d}-curriculum.yaml"
        for base in (CONTRACTS_DIR, CONTRACTS_UPLOAD_DIR):
            p = base / name
            if base.exists() and p.exists():
                data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
                lab = data.get("lab") or {}
                if lab.get("primary_files") or lab.get("inherited_files"):
                    return {
                        "primary_files": list(lab.get("primary_files") or []),
                        "inherited_files": list(lab.get("inherited_files") or []),
                        "workspace_mode": lab.get("workspace_mode"),
                    }
    except Exception:
        pass
    return {}


def _materialize_ws(camp_id: str, learner_id: str) -> Path:
    """Hydrate current head into a local path for file browsing / evaluate."""
    with db_cursor() as cur:
        cur.execute(
            "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
            (camp_id, learner_id),
        )
        head = cur.fetchone()
    snap = head["snapshot_id"] if head else None
    dest = workspace_path(camp_id, learner_id)
    if snap:
        hydrate_workspace(camp_id, learner_id, snap, dest)
    return dest


_LANG_BY_EXT = {
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".md": "markdown",
    ".markdown": "markdown",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".txt": "plaintext",
}
_BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".zip", ".woff", ".woff2", ".ico", ".svg"}
_MIME_BY_EXT = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".md": "text/markdown",
    ".sql": "application/sql",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}


def _ext(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    i = name.rfind(".")
    return name[i:].lower() if i >= 0 else ""


def _file_meta(rel: str, size: int) -> dict[str, Any]:
    ext = _ext(rel)
    binary = ext in _BINARY_EXT
    return {
        "path": rel,
        "size": size,
        "kind": "binary" if binary else "text",
        "editable": not binary,
        "language": _LANG_BY_EXT.get(ext, "plaintext"),
        "mime": _MIME_BY_EXT.get(ext, "application/octet-stream" if binary else "text/plain"),
    }


def _assert_workspace_access(request: Request, camp_id: str, learner_id: str) -> Any:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权访问他人工作区")
    if getattr(request.state, "camp_id", None) and request.state.camp_id != camp_id and user.role == "learner":
        raise HTTPException(403, "营期不匹配")
    return user


def _snapshot_head(camp_id: str, learner_id: str, ws: Path, *, job_id: str | None = None) -> dict[str, Any]:
    with db_cursor() as cur:
        cur.execute(
            "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
            (camp_id, learner_id),
        )
        head = cur.fetchone()
        parent_id = head["snapshot_id"] if head else None
    snap = snapshot_workspace(camp_id, learner_id, ws, parent_id=parent_id, job_id=job_id)
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO workspace_snapshots (id, camp_id, learner_id, parent_id, manifest_key, object_prefix, size_bytes, file_count, created_by_job_id)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                snap["id"],
                camp_id,
                learner_id,
                snap.get("parent_id"),
                snap["manifest_key"],
                snap["object_prefix"],
                snap["size_bytes"],
                snap["file_count"],
                job_id,
            ),
        )
        cur.execute(
            """
            INSERT INTO workspace_heads (camp_id, learner_id, snapshot_id, version, updated_at)
            VALUES (?, ?, ?, 1, NOW())
            ON CONFLICT (camp_id, learner_id) DO UPDATE
            SET snapshot_id=EXCLUDED.snapshot_id, version=workspace_heads.version+1, updated_at=NOW()
            """,
            (camp_id, learner_id, snap["id"]),
        )
    return snap


def _safe_rel(path: str) -> str:
    rel = (path or "").strip().lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(400, "invalid path")
    return rel


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "agent-gateway",
        "agent_mode": AGENT_MODE,
        "anycode_url": ANYCODE_DASHBOARD_URL,
        "anycode_up": _anycode_up(),
        "workspace_max_bytes": WORKSPACE_MAX_BYTES,
    }


@router.post("/api/v1/agent/workspaces/ensure")
def ensure_workspace(body: EnsureWorkspace, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    ws = _materialize_ws(camp_id, learner_id)
    size = workspace_size_bytes(ws)
    return {"workspace": str(ws), "size_bytes": size, "max_bytes": WORKSPACE_MAX_BYTES, "camp_id": camp_id, "learner_id": learner_id}


@router.get("/api/v1/agent/workspaces/{camp_id}/{learner_id}/files")
def list_files(
    camp_id: str,
    learner_id: str,
    request: Request,
    day: int | None = None,
    view: str = "all",
) -> dict[str, Any]:
    """List workspace files, optionally tagged by a day's `lab.primary_files`
    / `inherited_files` (workspace day-view, A). ``view=primary`` narrows the
    returned ``files`` to today's focus (falls back to the full list when the
    day declares no `primary_files`); ``view=history`` returns everything
    that is *not* today's primary (i.e. inherited + unrelated). ``view=all``
    (default) returns every file, each tagged with a `bucket`."""
    _assert_workspace_access(request, camp_id, learner_id)
    ws = _materialize_ws(camp_id, learner_id)
    all_files: list[dict[str, Any]] = []
    for p in sorted(ws.rglob("*")):
        if not p.is_file():
            continue
        rel = str(p.relative_to(ws))
        meta = _file_meta(rel, p.stat().st_size)
        all_files.append(meta)

    meta = _load_lab_files_meta(camp_id, day, learner_id)
    primary_set = set(meta.get("primary_files") or [])
    inherited_set = set(meta.get("inherited_files") or [])
    if primary_set or inherited_set:
        for f in all_files:
            if f["path"] in primary_set:
                f["bucket"] = "primary"
            elif f["path"] in inherited_set:
                f["bucket"] = "inherited"
            else:
                f["bucket"] = "other"
        primary_files = [f for f in all_files if f["bucket"] == "primary"]
        inherited_files = [f for f in all_files if f["bucket"] != "primary"]
    else:
        primary_files = []
        inherited_files = []

    if view == "primary" and primary_files:
        files = primary_files
    elif view == "history" and (primary_set or inherited_set):
        files = inherited_files
    else:
        files = all_files

    return {
        "workspace": str(ws),
        "files": files,
        "primary": primary_files,
        "inherited": inherited_files,
        "size_bytes": workspace_size_bytes(ws),
    }


@router.get("/api/v1/agent/workspaces/{camp_id}/{learner_id}/file")
def read_file(camp_id: str, learner_id: str, request: Request, path: str = "index.html") -> dict[str, Any]:
    _assert_workspace_access(request, camp_id, learner_id)
    ws = _materialize_ws(camp_id, learner_id)
    rel = _safe_rel(path)
    fp = resolve_safe(ws, rel)
    if not fp.is_file():
        raise HTTPException(404, "file not found")
    meta = _file_meta(rel, fp.stat().st_size)
    if meta["kind"] == "binary":
        return {**meta, "content": "", "status": "binary"}
    if meta["size"] > 200_000:
        return {**meta, "content": "", "status": "too_large"}
    try:
        content = fp.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return {**meta, "kind": "binary", "editable": False, "content": "", "status": "binary"}
    return {**meta, "content": content, "status": "ok"}


class WriteFileBody(BaseModel):
    path: str
    content: str = ""


class MkdirBody(BaseModel):
    path: str


class RenameBody(BaseModel):
    from_path: str
    to_path: str


@router.put("/api/v1/agent/workspaces/{camp_id}/{learner_id}/files")
def write_file(camp_id: str, learner_id: str, body: WriteFileBody, request: Request) -> dict[str, Any]:
    """Write a text file into the learner workspace and create a new head snapshot."""
    user = _assert_workspace_access(request, camp_id, learner_id)
    rel = _safe_rel(body.path)
    if len(body.content.encode("utf-8")) > WORKSPACE_MAX_BYTES:
        raise HTTPException(400, "file too large")

    ws = _materialize_ws(camp_id, learner_id)
    fp = resolve_safe(ws, rel)
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(body.content, encoding="utf-8")
    size = workspace_size_bytes(ws)
    if size > WORKSPACE_MAX_BYTES:
        raise HTTPException(400, "workspace quota exceeded")

    snap = _snapshot_head(camp_id, learner_id, ws)
    write_audit("workspace.write", actor_id=user.id, camp_id=camp_id, resource_type="workspace", resource_id=learner_id)
    return {"ok": True, "path": rel, "snapshot_id": snap["id"], "size_bytes": snap["size_bytes"]}


@router.post("/api/v1/agent/workspaces/{camp_id}/{learner_id}/mkdir")
def mkdir(camp_id: str, learner_id: str, body: MkdirBody, request: Request) -> dict[str, Any]:
    user = _assert_workspace_access(request, camp_id, learner_id)
    rel = _safe_rel(body.path)
    ws = _materialize_ws(camp_id, learner_id)
    dp = resolve_safe(ws, rel)
    if dp.exists() and not dp.is_dir():
        raise HTTPException(400, "path exists as file")
    dp.mkdir(parents=True, exist_ok=True)
    # Keep empty dirs visible across hydrate by placing a placeholder marker.
    marker = dp / ".gitkeep"
    if not marker.exists():
        marker.write_text("", encoding="utf-8")
    snap = _snapshot_head(camp_id, learner_id, ws)
    write_audit("workspace.mkdir", actor_id=user.id, camp_id=camp_id, resource_type="workspace", resource_id=learner_id)
    return {"ok": True, "path": rel, "snapshot_id": snap["id"]}


@router.post("/api/v1/agent/workspaces/{camp_id}/{learner_id}/rename")
def rename_path(camp_id: str, learner_id: str, body: RenameBody, request: Request) -> dict[str, Any]:
    user = _assert_workspace_access(request, camp_id, learner_id)
    src_rel = _safe_rel(body.from_path)
    dst_rel = _safe_rel(body.to_path)
    ws = _materialize_ws(camp_id, learner_id)
    src = resolve_safe(ws, src_rel)
    dst = resolve_safe(ws, dst_rel)
    if not src.exists():
        raise HTTPException(404, "source not found")
    if dst.exists():
        raise HTTPException(409, "destination exists")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    snap = _snapshot_head(camp_id, learner_id, ws)
    write_audit("workspace.rename", actor_id=user.id, camp_id=camp_id, resource_type="workspace", resource_id=learner_id)
    return {"ok": True, "from_path": src_rel, "to_path": dst_rel, "snapshot_id": snap["id"]}


@router.delete("/api/v1/agent/workspaces/{camp_id}/{learner_id}/files")
def delete_path(camp_id: str, learner_id: str, request: Request, path: str) -> dict[str, Any]:
    user = _assert_workspace_access(request, camp_id, learner_id)
    rel = _safe_rel(path)
    ws = _materialize_ws(camp_id, learner_id)
    target = resolve_safe(ws, rel)
    if not target.exists():
        raise HTTPException(404, "path not found")
    if target.is_dir():
        import shutil

        shutil.rmtree(target)
    else:
        target.unlink()
    snap = _snapshot_head(camp_id, learner_id, ws)
    write_audit("workspace.delete", actor_id=user.id, camp_id=camp_id, resource_type="workspace", resource_id=learner_id)
    return {"ok": True, "path": rel, "snapshot_id": snap["id"]}


@router.post("/api/v1/agent/workspaces/{camp_id}/{learner_id}/evaluate")
def evaluate_workspace(camp_id: str, learner_id: str, body: EvaluateBody, request: Request) -> dict[str, Any]:
    """Evaluate current workspace head against rubric (no agent job required)."""
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权评测")
    ws = _materialize_ws(camp_id, learner_id)
    return _evaluate_workspace(ws, body.rubric)


_PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:;"
_LINK_RE = re.compile(r'<link\b[^>]*\bhref=["\']([^"\']+)["\'][^>]*>', re.I)
_SCRIPT_RE = re.compile(r'<script\b[^>]*\bsrc=["\']([^"\']+)["\'][^>]*>\s*</script>', re.I)


def _is_relative_asset(ref: str) -> bool:
    if not ref or ref.startswith(("http://", "https://", "//", "/")):
        return False
    return True


def _join_asset_path(dir_path: str, ref: str) -> str:
    clean = ref.removeprefix("./")
    return f"{dir_path}/{clean}".replace("//", "/") if dir_path else clean


def _bundle_html_preview(ws: Path, html_path: str) -> str:
    fp = resolve_safe(ws, _safe_rel(html_path))
    if not fp.is_file():
        raise HTTPException(404, "file not found")
    html = fp.read_text(encoding="utf-8")
    doc = html
    parent = Path(html_path).parent.as_posix()
    if parent == ".":
        parent = ""
    for m in _LINK_RE.finditer(html):
        ref = m.group(1)
        if not _is_relative_asset(ref):
            continue
        asset = _join_asset_path(parent, ref)
        afp = resolve_safe(ws, _safe_rel(asset))
        if afp.is_file():
            css = afp.read_text(encoding="utf-8")
            doc = doc.replace(m.group(0), f'<style data-inlined-from="{ref}">\n{css}\n</style>', 1)
    for m in _SCRIPT_RE.finditer(html):
        ref = m.group(1)
        if not _is_relative_asset(ref):
            continue
        asset = _join_asset_path(parent, ref)
        afp = resolve_safe(ws, _safe_rel(asset))
        if afp.is_file():
            js = afp.read_text(encoding="utf-8")
            doc = doc.replace(m.group(0), f'<script data-inlined-from="{ref}">\n{js}\n</script>', 1)
    return _inject_preview_viewport(doc)


def _inject_preview_viewport(html: str) -> str:
    if re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I):
        return html
    viewport = '<meta name="viewport" content="width=device-width, initial-scale=1">'
    if re.search(r"<head[\s>]", html, re.I):
        return re.sub(r"(<head[^>]*>)", r"\1" + viewport, html, count=1, flags=re.I)
    return f"<!doctype html><html><head>{viewport}</head><body>{html}</body></html>"


@router.get("/api/v1/agent/workspaces/{camp_id}/{learner_id}/preview-url")
def preview_url(camp_id: str, learner_id: str, request: Request, path: str = "index.html") -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权预览")
    with db_cursor() as cur:
        cur.execute(
            "SELECT snapshot_id FROM workspace_heads WHERE camp_id=? AND learner_id=?",
            (camp_id, learner_id),
        )
        head = cur.fetchone()
    if not head:
        raise HTTPException(404, "无快照")
    prefix = snapshot_prefix(camp_id, learner_id, head["snapshot_id"])
    key = f"{prefix}/files/{path.lstrip('/')}"
    url = get_store().presign_get(S3_BUCKET_WORKSPACES, key)
    write_audit("workspace.preview", actor_id=user.id, camp_id=camp_id, resource_type="workspace", resource_id=learner_id)
    return {"url": url, "expires_in": S3_PRESIGN_GET_EXPIRES, "path": path}


@router.get("/api/v1/agent/workspaces/{camp_id}/{learner_id}/preview-render")
def preview_render(camp_id: str, learner_id: str, request: Request, path: str = "index.html") -> HTMLResponse:
    _assert_workspace_access(request, camp_id, learner_id)
    ws = _materialize_ws(camp_id, learner_id)
    doc = _bundle_html_preview(ws, path)
    write_audit(
        "workspace.preview_render",
        actor_id=require_user(request).id,
        camp_id=camp_id,
        resource_type="workspace",
        resource_id=learner_id,
    )
    return HTMLResponse(
        content=doc,
        headers={
            "Content-Security-Policy": _PREVIEW_CSP,
            "X-Frame-Options": "SAMEORIGIN",
        },
    )


@router.get("/api/v1/agent/workspaces/{camp_id}/{learner_id}/snapshots")
def list_snapshots(camp_id: str, learner_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权查看")
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, parent_id, size_bytes, file_count, created_at, created_by_job_id
            FROM workspace_snapshots WHERE camp_id=? AND learner_id=? ORDER BY created_at DESC LIMIT 50
            """,
            (camp_id, learner_id),
        )
        items = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT snapshot_id, version FROM workspace_heads WHERE camp_id=? AND learner_id=?", (camp_id, learner_id))
        head = cur.fetchone()
    return {"items": items, "head": dict(head) if head else None}


@router.get("/api/v1/agent/workspaces/{camp_id}/{learner_id}/snapshots/{snapshot_id}/file")
def read_snapshot_file(
    camp_id: str,
    learner_id: str,
    snapshot_id: str,
    request: Request,
    path: str,
) -> dict[str, Any]:
    """Read a single text file from an immutable workspace snapshot (for Diff)."""
    _assert_workspace_access(request, camp_id, learner_id)
    rel = _safe_rel(path)
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM workspace_snapshots WHERE id=? AND camp_id=? AND learner_id=?",
            (snapshot_id, camp_id, learner_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "snapshot not found")
    meta = _file_meta(rel, 0)
    if meta["kind"] == "binary":
        return {**meta, "content": "", "status": "binary", "snapshot_id": snapshot_id}
    prefix = snapshot_prefix(camp_id, learner_id, snapshot_id)
    key = f"{prefix}/files/{rel}"
    try:
        data = get_store().get_bytes(S3_BUCKET_WORKSPACES, key)
    except Exception as exc:
        raise HTTPException(404, f"file not in snapshot: {exc}") from exc
    size = len(data)
    meta = _file_meta(rel, size)
    if meta["kind"] == "binary":
        return {**meta, "content": "", "status": "binary", "snapshot_id": snapshot_id}
    if size > 200_000:
        return {**meta, "content": "", "status": "too_large", "snapshot_id": snapshot_id}
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        return {**meta, "kind": "binary", "editable": False, "content": "", "status": "binary", "snapshot_id": snapshot_id}
    return {**meta, "content": content, "status": "ok", "snapshot_id": snapshot_id}


@router.post("/api/v1/agent/workspaces/{camp_id}/{learner_id}/restore")
def restore_snapshot(camp_id: str, learner_id: str, request: Request, snapshot_id: str) -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权恢复")
    with db_cursor() as cur:
        cur.execute(
            "SELECT id FROM workspace_snapshots WHERE id=? AND camp_id=? AND learner_id=?",
            (snapshot_id, camp_id, learner_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "snapshot not found")
        cur.execute(
            """
            INSERT INTO workspace_heads (camp_id, learner_id, snapshot_id, version, updated_at)
            VALUES (?, ?, ?, 1, NOW())
            ON CONFLICT (camp_id, learner_id) DO UPDATE
            SET snapshot_id=EXCLUDED.snapshot_id, version=workspace_heads.version+1, updated_at=NOW()
            """,
            (camp_id, learner_id, snapshot_id),
        )
    write_audit("workspace.restore", actor_id=user.id, camp_id=camp_id, resource_id=snapshot_id)
    return {"ok": True, "snapshot_id": snapshot_id}


@router.post("/api/v1/agent/jobs")
def create_job(body: CreateJob, request: Request) -> dict[str, Any]:
    learner_id = session_learner_id(request)
    camp_id = session_camp_id(request, body.camp_id)
    _guard_prompt(body.prompt)
    with db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS c FROM jobs WHERE learner_id=? AND kind='agent_job' AND status IN ('queued','hydrating','running','evaluating','snapshotting')",
            (learner_id,),
        )
        row = cur.fetchone()
        if int(row["c"] or 0) >= 1:
            raise HTTPException(429, "learner already has an active agent job")
    runner = _resolve_runner(body.force_stub)
    legacy_id = str(uuid4())
    ws = workspace_path(camp_id, learner_id)
    full_prompt = f"{SYSTEM_PREFIX}\n\n学员任务：\n{body.prompt}"
    with db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO agent_jobs
            (id, learner_id, camp_id, workspace, prompt, status, runner, anycode_session_id,
             anycode_project_id, events_json, result_json, artifact_uri, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (legacy_id, learner_id, camp_id, str(ws), body.prompt, "queued", runner, None, None, "[]", "{}", None, now_iso(), now_iso()),
        )
    job_id = queue.enqueue_job(
        "agent_job",
        {
            "camp_id": camp_id,
            "learner_id": learner_id,
            "prompt": full_prompt if runner == "anycode" else body.prompt,
            "node_id": body.node_id,
            "force_stub": body.force_stub or runner == "stub",
            "legacy_job_id": legacy_id,
            "runner": runner,
            "skills": body.skills,
        },
        camp_id=camp_id,
        learner_id=learner_id,
    )
    write_audit("agent.job_create", actor_id=learner_id, camp_id=camp_id, resource_type="job", resource_id=job_id)
    return {"job_id": job_id, "legacy_job_id": legacy_id, "runner": runner, "status": "queued"}


@router.get("/api/v1/agent/jobs/{job_id}")
def get_job(job_id: str, request: Request) -> dict[str, Any]:
    user = require_user(request)
    job = queue.get_job(job_id)
    if not job:
        row = _job_row(job_id)
        if user.role not in ("author", "admin") and row.get("learner_id") != user.id:
            raise HTTPException(403, "无权查看")
        row["events"] = json.loads(row.pop("events_json") or "[]") if "events_json" in row else []
        row["result"] = json.loads(row.pop("result_json") or "{}") if isinstance(row.get("result_json"), str) else (row.get("result_json") or {})
        return row
    if user.role not in ("author", "admin") and job.get("learner_id") != user.id:
        raise HTTPException(403, "无权查看")
    payload = job.get("payload_json")
    if isinstance(payload, str):
        payload = json.loads(payload)
    result = job.get("result_json")
    if isinstance(result, str):
        result = json.loads(result)
    return {**job, "payload": payload, "result": result, "events": queue.list_events(job_id)}


@router.get("/api/v1/agent/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request) -> StreamingResponse:
    user = require_user(request)
    job = queue.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if user.role not in ("author", "admin") and job.get("learner_id") != user.id:
        raise HTTPException(403, "无权查看")
    last_header = request.headers.get("Last-Event-ID") or request.query_params.get("after") or "0"
    try:
        after = int(last_header)
    except ValueError:
        after = 0

    async def gen():
        nonlocal after
        for _ in range(240):
            events = queue.list_events(job_id, after_id=after)
            for ev in events:
                after = int(ev["id"])
                data = {
                    "id": ev["id"],
                    "type": ev["event_type"],
                    "message": ev.get("message"),
                    "payload": ev.get("payload_json") or {},
                    "ts": str(ev.get("created_at")),
                }
                yield f"id: {after}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
            j = queue.get_job(job_id)
            if j and j["status"] in ("succeeded", "failed", "cancelled", "dead_letter"):
                yield f"data: {json.dumps({'type': 'terminal', 'status': j['status']})}\n\n"
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/api/v1/agent/jobs/{job_id}/evaluate")
def evaluate_job(job_id: str, body: EvaluateBody, request: Request) -> dict[str, Any]:
    user = require_user(request)
    job = queue.get_job(job_id) or _job_row(job_id)
    learner_id = job.get("learner_id")
    camp_id = job.get("camp_id")
    if user.role not in ("author", "admin") and learner_id != user.id:
        raise HTTPException(403, "无权评测")
    payload = job.get("payload_json") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    camp_id = camp_id or payload.get("camp_id")
    learner_id = learner_id or payload.get("learner_id")
    ws = _materialize_ws(camp_id, learner_id)
    return _evaluate_workspace(ws, body.rubric)


@router.post("/api/v1/agent/jobs/{job_id}/cancel")
def cancel_job(job_id: str, request: Request) -> dict[str, str]:
    """Request cancellation. This is cooperative: it only flips status to
    'cancelled' + logs an event here. The worker (services/worker/__main__.py)
    polls queue.is_cancelled(job_id) between stages (after hydrate, before
    anycode, after anycode) and stops as soon as it observes it — there is no
    hard kill of an in-flight anyCode turn."""
    user = require_user(request)
    job = queue.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    if user.role not in ("author", "admin") and job.get("learner_id") != user.id:
        raise HTTPException(403, "无权取消")
    if job["status"] in ("succeeded", "failed", "cancelled", "dead_letter"):
        return {"status": job["status"]}
    queue.update_job(job_id, status="cancelled")
    queue.append_event(job_id, "cancelled", "cancelled by user")
    return {"status": "cancelled"}


@router.get("/api/v1/agent/learners/{learner_id}/jobs")
def list_jobs(
    learner_id: str,
    request: Request,
    limit: int = 20,
    active_only: bool = False,
    camp_id: str | None = None,
    node_id: str | None = None,
) -> dict[str, Any]:
    user = require_user(request)
    if user.role not in ("author", "admin") and user.id != learner_id:
        raise HTTPException(403, "无权查看")
    with db_cursor() as cur:
        cur.execute(
            """
            SELECT id, kind, status, camp_id, learner_id, payload_json, created_at, updated_at
            FROM jobs WHERE learner_id=? AND kind='agent_job'
            ORDER BY created_at DESC LIMIT ?
            """,
            (learner_id, max(limit, 50)),
        )
        rows = [dict(r) for r in cur.fetchall()]
    active_status = {"queued", "hydrating", "running", "evaluating", "snapshotting"}
    items = []
    for r in rows:
        payload = r.get("payload_json") or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        if active_only and r.get("status") not in active_status:
            continue
        if camp_id and r.get("camp_id") != camp_id and payload.get("camp_id") != camp_id:
            continue
        if node_id and payload.get("node_id") != node_id:
            continue
        items.append(
            {
                "id": r["id"],
                "kind": r["kind"],
                "status": r["status"],
                "camp_id": r.get("camp_id") or payload.get("camp_id"),
                "learner_id": r["learner_id"],
                "node_id": payload.get("node_id"),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
            }
        )
        if len(items) >= limit:
            break
    return {"items": items}


@router.get("/api/v1/agent/jobs/{job_id}/summary")
def job_summary(job_id: str, request: Request) -> dict[str, Any]:
    row = get_job(job_id, request)
    events = row.get("events") or []
    result = row.get("result") or {}
    return {
        "job_id": job_id,
        "status": row["status"],
        "runner": (row.get("payload") or {}).get("runner") or row.get("runner"),
        "artifact_uri": row.get("artifact_uri"),
        "files": result.get("files") if isinstance(result, dict) else None,
        "snapshot_id": result.get("snapshot_id") if isinstance(result, dict) else None,
        "last_events": events[-5:],
    }


app.include_router(router)
