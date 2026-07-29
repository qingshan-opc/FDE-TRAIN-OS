# 特级教师的口播范式（FDE 口播升级参考）

> **优先读本文件 + `data/master-teacher-study/ANALYSIS.md`（真实 ASR）**  
> 上一版来自论文摘要，已与真实课堂差距较大，已废弃为唯一依据。

## 真实数据来源

| 项 | 值 |
|----|-----|
| 视频 | Bilibili `BV1et411U7qN` p5 · 窦桂梅《丑小鸭》课堂实录 |
| 切片 | 前 5 分钟音频 |
| 转写 | Whisper base → `data/master-teacher-study/transcripts/dou_5min.txt` |
| 命令 | `yt-dlp` 下载 · `ffmpeg` 切片 · `whisper --language Chinese` |

## ASR 提炼的课堂结构（不是堆「对吧」）

1. **仪式开场**：同学们好，我是你们的老师404 → 先问一句（**不用「请坐」**）  
2. **仪式收束**：`同学们，本节先到这里。` — 见 [`oral-ritual.md`](./oral-ritual.md)  
2. **问链**：先问，停，再推进（5 分钟可仍在导入）  
3. **虚拟/真实互动**：来，同学 · 还有吗 · 听见了吗 · 读吧  
4. **复述+肯定**：重复学生观点 →「说得真好」「谢谢你的发现」  
5. **慢 reveal**：故事/现象在前，定义在后  
6. **屏幕锚点**：来，看屏幕 · 对照这张表  

## 篇幅

- **不限制 4 分钟**；参考窦桂梅节奏，FDE 单节约 **6–8 分钟**（6 段 × 350–550 字）
- 禁止论文摘要式一段一结论

## 404 老师人设

**仪式开场固定句式**：「同学们好，我是你们的老师404。」——然后先问一句，再进正题。不用「请坐」。  
**仪式收束固定句式**：「同学们，本节先到这里。」——见 [`oral-ritual.md`](./oral-ritual.md)。

站着讲、有温度、像真人老师；Tech 概念用「人话 + 虚拟学生问答」落地。口播中自称「404老师」，不用「斗老师」。

## 第七天改稿入口

```bash
.venv/bin/python scripts/apply_day07_master_teacher_narration.py
# 确认后
.venv/bin/python scripts/run_bootcamp_video_pipeline.py --day 7 --section 01
```
