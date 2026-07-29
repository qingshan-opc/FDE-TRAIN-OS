# 框架级课节 · 细讲范式（五阶段等）

适用于「企业数字化五阶段」「LLM 四层」「技能五段」这类**梯子/分层诊断图**课节。金标准：`day05_s02.yaml` + `day-05/section-02-enterprise-digital-stages/`。

## 分段原则

1. **一段一级**（或一层）：开场总览 → 每级独立段 → 对回学员项目 → 收束三问  
2. 禁止把 L1+L2、L3+L4 **糊成一段**（易变成名词清单，细讲失败）  
3. 每级口播固定三问骨架（可换词，不可缺）：
   - **企业在干什么？**
   - **系统长什么样？**
   - **人的角色是谁？**
4. 每级至少一处「有同学可能会说/问…」+「听见了吗？」收束  
5. 段末钉回学员产物（驾驶舱 / API_Spec / 表结构 / Skill），避免空讲名词

## PPT 要点（显式 `ppt:` 卡）

每级 slide 至少三块，与口播对齐：

| 卡 | 内容 |
|----|------|
| 企业 | 这一级业务在解决什么 |
| 系统 | 典型技术形态（OA / DB / API / LLM / Skill） |
| 人的角色 | 录入员 → owner → 契约设计者 → 验收官 → FDE |

开场/对回项目页必须挂**讲解图**（如 `enterprise-digital-stages.svg`），禁止只有文字卡。

## 禁用

- 口播/上屏：`Day N` / `Week N` →「第 N 天」「第 N 周」
- 书面腔：「学生自检三问——答得出才算听懂」→「我问三句，你们心里答得上，这节才算听明白」
- 「整仓」→「整个代码仓库」
- PPT 用 `oral_cards` 回退贴口播正文（见 sync 脚本：只吃显式 `ppt`）
- 过稿稿里留「待审 / 待 TTS 后填」当作终稿语气

## YAML 骨架（复制改）

```yaml
title: "第五天 · 第 2 节 · …"
segments:
  - id: "01-open"      # 仪式开场 + 总览梯子 + 讲解图
  - id: "02-<l1>"      # 一级一段
  - id: "03-<l2>"
  - id: "04-<l3>"
  - id: "05-<l4>"
  - id: "06-<l5>"
  - id: "07-mapback"   # 对回学员项目 / 驾驶舱
  - id: "08-close"     # 仪式收束 + 我问三句
```

同步：

```bash
.venv/bin/python -c "from scripts.sync_bootcamp_section_from_yaml import sync_section; sync_section(5,'02', regen_html=True)"
```

**注意**：勿在 Day6+ 细讲后默认跑 `align_day06_section_ppt.main()`——会覆写细讲 yaml。
