# FDE 后端测试说明

路径均相对于仓库根；`PYTHONPATH` 需含 `backend`（`./scripts/run_tests.sh` 已设置）。

## 分层（对齐生产计划）

| 层 | 目录 | 依赖 | 命令 |
|----|------|------|------|
| 单元 | `backend/tests/test_unit_*.py` `backend/tests/test_sandbox.py` | 无 | `pytest -q backend/tests/test_unit_keys_magic.py backend/tests/test_sandbox.py` |
| 集成 | `backend/tests/test_jobs_queue.py` 等 | 本机 PG `:5433` + MinIO `:9000` | `pytest -q backend/tests/test_jobs_queue.py backend/tests/test_storage_workspace.py backend/tests/test_document_ingest.py` |
| API 契约 | `backend/tests/test_api_rbac.py` | 运行中的 `fde-api :8760` | `pytest -q backend/tests/test_api_rbac.py` |
| 浏览器 | `e2e/tests/*.spec.ts` | API + 已构建 `web/dist` | `cd e2e && npx playwright test --project=chromium` |

不可用依赖会 `pytest.skip`，不会假绿强行失败。

## 一键

```bash
./scripts/run_tests.sh
```

## 实践依据（摘要）

- 队列 `FOR UPDATE SKIP LOCKED` **必须打真 PostgreSQL**，不能用 SQLite 替代（锁语义不同）。
- FastAPI 契约测优先 `httpx`/`TestClient` 打真实鉴权与 CSRF，而不是只测 handler 函数。
- MinIO hydrate/snapshot 用真实 S3 API；灵知 publish 用 mock HTTP，live 路径留给冒烟脚本。
