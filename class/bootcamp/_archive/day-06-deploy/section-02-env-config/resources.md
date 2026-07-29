# 第 2 节 · 资源

## 必读

- 讲解图：[环境与配置分离](../../assets/diagrams/env-config-split.svg)
- lesson.md 三件套表

## 分家检查命令

```bash
# 仓库里搜敏感词（应该只命中 .env.example 的假值）
git grep -n -i "token\|secret\|sk-" -- ':!.env.example'

# 确认 .env 被忽略
git check-ignore .env && echo "OK: .env 已被忽略"
```

## Prompt 草稿（改造用）

```
角色：Python 后端工程师
任务：把 main.py 中的硬编码配置改为环境变量读取
约束：
- 所有密钥/令牌/可配置项改从 os.environ 读
- 生成 .env.example：每个变量带中文注释与假值
- 本地开发用 python-dotenv 自动加载 .env
- 列出线上平台需要配置的变量清单
格式：改造后代码 + .env.example + 变量清单
```

## 选读（公开课）

- O3 部署篇：12-Factor 配置原则、密钥管理进阶
- O4 词典：「环境变量 / .env / gitignore」词条
