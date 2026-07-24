# 0.2 验收清单

## 环境

```bash
docker compose up -d postgres minio   # 若尚未启动
./scripts/start.sh                    # :8760
./scripts/smoke_0.2.sh
```

入口：http://127.0.0.1:8760/app/  
账号：`demo@fde.local` / `demo1234`

## 手工验收（对照学员台 Spec）

| ID | 步骤 | 期望 |
|----|------|------|
| A1 | 打开 `/app/` | 登录屏，演示账号预填 |
| A2 | 登录 | 进入工作台，显示 email · camp |
| A3 | Day1 左栏 | 见 learn→…→unlock；首节点 available |
| A4 | 完成学习 | steps 可见；完成后 quiz available |
| A5 | 提交测验（正确选项） | pass；lab 解锁 |
| A6 | 启动 Agent | SSE 有进度；iframe 出现页面 |
| A7 | 评测 + 完成 lab | eval pass；passport 含 agent track |
| A8 | 切 Day2 | 可加载 day-02 包并至少完成 learn |

## 脚本验收

`scripts/smoke_0.2.sh` 必须：

1. healthz OK  
2. 登录  
3. Day1 learn complete → quiz pass → agent stub/auto → eval pass → passport  
4. Day2 day package `runner=agent` 可加载  
5. `/app/` HTTP 200  

## Spec 文档齐套

- [ ] `docs/spec/0.2/README.md`
- [ ] `learner-workbench.md`
- [ ] `day-package.md`
- [ ] `api-surface.md`
- [ ] 本文件

## 评审备注

灵知 offline 不阻塞 A1–A8。anyCode 不可达时 Agent 走 stub，仍算通过。
