# 第 3 节 · 资源

## 必读

- lesson.md 的病根表 + 冻饺子比喻 + 云原生三特征

## Dockerfile 一瞥（看懂即可，今天不用写）

```dockerfile
FROM python:3.12-slim            # 底：标准 Python 环境
COPY . /app                      # 料：把你的代码放进去
RUN pip install -r requirements.txt   # 锁定依赖
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]  # 怎么启动
```

四行对应：底、料、装、启动——托管平台帮你生成的大概就长这样。

## 词汇卡

| 词 | 一句话 |
|---|--------|
| 镜像 Image | 冻好的包裹（代码+环境+依赖） |
| 容器 Container | 跑起来的镜像实例 |
| Dockerfile | 冻包裹的配方 |
| 云原生 | 应用生来为云设计：镜像化、配置外置、无状态 |

## 选读（公开课）

- O3 云原生篇：Docker 实操入门、K8s 是什么、Serverless
- O4 词典：「镜像 / 容器 / 无状态 / 编排」词条
