# 第 4 节 · 资源

## 必读

- lesson.md 的清单模板（复制改造为你的版本）

## 快速体检命令包

```bash
# 三接口连通性（本地）
curl -s -o /dev/null -w "%{http_code}" localhost:8000/api/kpi
curl -s -o /dev/null -w "%{http_code}" localhost:8000/api/exceptions
curl -s localhost:8000/api/summary | head -c 200

# 安全检查
git grep -n -i "token\|secret\|sk-" -- ':!.env.example'
git status --short
```

## 常见红灯速查

| 红灯 | 高频原因 |
|------|---------|
| 摘要数字与库不符 | 装配块日期写死成昨天的了 |
| 降级标识不切换 | 前端没读 source 字段（Day 5 接电漏项） |
| 空态不出现 | 清空表后接口有缓存/页面有缓存，强刷 |
| git grep 命中真值 | 回第 2 节分家流程 |

## 选读（公开课）

- O3 测试篇：冒烟测试、Playwright E2E 入门（V2 自动化候选）
