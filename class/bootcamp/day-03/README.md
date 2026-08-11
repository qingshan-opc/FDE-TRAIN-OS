# Day 3 · 给前端接上真实规则与数据

> 今日目标：**承接 Day2 的 `frontend-api-needs.md`，在 QRAE 中亲自完成“前端交接 → 后端设计 → 本地服务 → 前后端联调 → 后端验收 → 测试接收”的第三次软件工程接力。**

## 这一天解决什么

Day2 的页面已经能运行，但仍主要使用演示数据。Day3 要让学员看懂后端的三件事：业务规则、数据存取和接口对话；先确认接口与数据合同，再生成可以本地运行的后端服务，最后让前端按合同连接。

第一版固定采用 Python 标准库 + SQLite，减少安装依赖。技术方案以后可以替换，但“先合同、后代码；先单独验证、再联调；谁负责、谁修改”的流程不会变。

## 六节课程

| 节 | 目录 | 主题 | 时长 | 形式 | 学员端产出 |
|---|---|---|---|---|---|
| 1 | `section-01-backend-role/` | 后端不是黑窗口：传统职能 vs AI 时代后端 | 15′ | 认知+对比 | 规则/数据/API 三件事 |
| 2 | `section-02-backend-handoff/` | 后端读取前端数据需求并确认方案 | 20′ | 交接实操 | 后端实施清单 |
| 3 | `section-03-api-data-contract/` | 先定 API 与数据合同 | 20′ | 合同实操 | `API_Spec.md`、`DB_Schema.md` |
| 4 | `section-04-build-local-service/` | 生成并启动本地后端 | 30′ | 分段实操 | `backend/server.py`、SQLite、`RUNBOOK.md` |
| 5 | `section-05-frontend-integration/` | 前端按合同接入后端 | 25′ | 联调实操 | 可查询、可提交的完整页面 |
| 6 | `section-06-accept-test-handoff/` | 后端过闸并交给测试 | 20′ | 交接实操 | `backend-acceptance.md`、`day3-handoff-log.md` |

## 今日固定交接链

```text
@后端读取 PRD + frontend-api-needs + frontend
  → 学员确认后端方案
  → 先写 API/数据合同
  → @后端实现并单独验证
  → @前端按 API 合同联调
  → 后端/前端各修各的
  → @测试只接收，Day4 再测试
```

## 过关标准

- `API_Spec.md` 与 `DB_Schema.md` 能一一对账；
- `backend/server.py` 可启动，健康检查返回成功；
- SQLite 数据写入后重启服务仍能查询；
- 前端通过 HTTP 接口查询和提交，不再只改本地演示数组；
- 至少验证一个成功场景和两个错误场景；
- 没有真实密钥、密码和隐私数据；
- `@测试` 已读取 PRD、接口合同、运行手册和验收记录，但没有提前执行 Day4。
