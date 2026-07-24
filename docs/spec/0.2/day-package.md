# Day Package Spec（0.3 扩展 · 兼容 0.2）

在 0.2 基础上增加课纲字段。编排优先加载 `day-{NN}-curriculum.yaml`。

## learn.capsules

```yaml
learn:
  require_capsules: true
  capsules:
    - id: c1
      title: 标题
      minutes: 20
      content: 正文
      practice: 小练提示（可选）
  steps: []   # 可由 capsules 标题自动派生
```

UI：学员需点开全部胶囊后才可「完成学习」（当 `require_capsules: true`）。

## project_brief / review_checklist

```yaml
project_brief: 企业任务说明
review_checklist:
  - 清单项 1
  - 清单项 2
```

透出到 `project` / `review` 节点 `refs`。

## lab.runner

- `agent`：需 `agent.prompt_template` + 文件类 rubric
- `sim`：需 `sim_kind`（`server` | `arch_design` | `web_dev` | `k8s`）+ seed/rubric

## 课纲包

见 [0.3/curriculum-721.md](../0.3/curriculum-721.md)。
