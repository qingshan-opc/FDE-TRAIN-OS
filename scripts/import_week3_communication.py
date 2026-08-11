#!/usr/bin/env python3
"""Import Week 3（企业沟通特训）from module docx quizzes → day-12..day-17.

Usage:
  .venv/bin/python scripts/import_week3_communication.py \\
    --docx-dir /path/to/drag \\
    [--write-contracts]
"""
from __future__ import annotations

import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import yaml

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

MODULES = [
    {
        "mod": 1,
        "day": 12,
        "title": "老板说的和老板真正要的",
        "slug": "boss-said-vs-wanted",
        "project": "企业沟通 · 需求解码",
        "file_prefix": "模块一",
    },
    {
        "mod": 2,
        "day": 13,
        "title": "公司组织图上看不到的信息",
        "slug": "org-chart-invisible",
        "project": "企业沟通 · 组织识别",
        "file_prefix": "模块二",
    },
    {
        "mod": 3,
        "day": 14,
        "title": "让任务可做可验收可汇报",
        "slug": "task-contract",
        "project": "企业沟通 · 任务契约",
        "file_prefix": "模块三",
    },
    {
        "mod": 4,
        "day": 15,
        "title": "AI 项目为什么推不动",
        "slug": "ai-project-stuck",
        "project": "企业沟通 · 障碍分诊",
        "file_prefix": "模块四",
    },
    {
        "mod": 5,
        "day": 16,
        "title": "让老板看见你的价值",
        "slug": "show-value",
        "project": "企业沟通 · 价值证明",
        "file_prefix": "模块五",
    },
    {
        "mod": 6,
        "day": 17,
        "title": "把自己变成一个畅销的职业产品",
        "slug": "career-product",
        "project": "企业沟通 · 职业产品",
        "file_prefix": "模块六",
    },
]


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    paras = []
    for p in root.iter(f"{W}p"):
        texts = [t.text or "" for t in p.iter(f"{W}t")]
        line = "".join(texts).strip()
        if line:
            paras.append(line)
    return "\n".join(paras)


def extract_abcd(text: str) -> list[list]:
    lines = text.splitlines()
    items: list[list] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if re.match(r"^A[\.、．]\s*", line):
            opts: list[str] = []
            j = i
            while j < len(lines) and re.match(r"^[A-D][\.、．]\s*", lines[j].strip()):
                opts.append(re.sub(r"^[A-D][\.、．]\s*", "", lines[j].strip()))
                j += 1
            stem = ""
            k = i - 1
            while k >= 0:
                s = lines[k].strip()
                if not s:
                    k -= 1
                    continue
                if re.match(r"^情境题\s*\d+", s) or re.match(r"^\d{2}\.\d", s) or s.startswith("04."):
                    k -= 1
                    continue
                if re.match(r"^[A-D][\.、．]|建议答案|参考答案|^答案", s):
                    break
                stem = s
                break
            ans = None
            explain = ""
            for t in range(j, min(j + 6, len(lines))):
                m = re.search(r"(?:建议答案|参考答案|答案)[:：]?\s*([A-D])", lines[t])
                if m:
                    ans = ord(m.group(1)) - ord("A")
                    explain = re.sub(
                        r".*?(?:建议答案|参考答案|答案)[:：]?\s*[A-D]\s*", "", lines[t]
                    ).strip()
                    explain = re.sub(r"^选项[A-D]", "", explain).strip()
                    if not explain and t + 1 < len(lines):
                        nxt = lines[t + 1].strip()
                        if nxt and not re.match(r"^(情境题|A[\.、]|04\.|PART|题号)", nxt):
                            explain = nxt
                    break
            if stem and len(opts) >= 2 and ans is not None and 0 <= ans < len(opts):
                while len(opts) < 3:
                    opts.append("（无此选项）")
                items.append([stem, opts[:4], ans, explain or "见课程讲解。"])
            i = j
            continue
        i += 1
    seen: set[str] = set()
    uniq: list[list] = []
    for it in items:
        if it[0] in seen:
            continue
        seen.add(it[0])
        uniq.append(it)
    return uniq


def extract_table_mod6(text: str) -> list[list]:
    lines = text.splitlines()
    start = None
    for i, l in enumerate(lines):
        if (
            l.strip() == "题号"
            and i + 2 < len(lines)
            and "情境" in lines[i + 1]
            and "标准判断" in lines[i + 2]
        ):
            start = i + 3
            break
    if start is None:
        return []
    items: list[list] = []
    i = start
    while i < len(lines):
        if not re.match(r"^\d+$", lines[i].strip()):
            if lines[i].strip().startswith(("04.3", "04.4", "PART")):
                break
            i += 1
            continue
        i += 1
        sit: list[str] = []
        while i < len(lines) and not re.match(r"^\d+$", lines[i].strip()) and not lines[i].strip().startswith("04."):
            if lines[i].strip():
                sit.append(lines[i].strip())
            i += 1
            if len(sit) >= 2:
                break
        if len(sit) < 2:
            continue
        q, correct = sit[0], sit[1]
        distractors = [
            "先扩大范围，再补证据和边界。",
            "用工具清单代替岗位定位与业务问题。",
            "把未验证结果写成已达成经营指标。",
        ]
        opts = [correct] + [d for d in distractors if d != correct][:3]
        while len(opts) < 3:
            opts.append("暂缓判断，等待更多信息。")
        items.append([q, opts[:4], 0, f"标准判断：{correct}"])
    return items


def find_docx(docx_dir: Path, prefix: str) -> Path:
    matches = sorted(docx_dir.glob(f"{prefix}*.docx"))
    if not matches:
        raise FileNotFoundError(f"找不到 {prefix}*.docx in {docx_dir}")
    return matches[0]


def write_day(meta: dict, quiz: list[list]) -> Path:
    day = meta["day"]
    day_dir = BC / f"day-{day:02d}"
    sec = f"section-01-{meta['slug']}"
    sec_dir = day_dir / sec
    sec_dir.mkdir(parents=True, exist_ok=True)

    readme = f"""# Day {day} · {meta['title']}

> 今日目标：**第三周企业沟通特训 · 模块{meta['mod']}**。先看口播（视频待上传），再完成概念验收答题。
> 总时长 45′ · 1 节 · 视频讲解 + 情境答题

## 这一天在解决什么

本课承接「企业沟通特训」第 {meta['mod']} 模块：**{meta['title']}**。  
今日只要求完成视频学习（上传后开放）与日级概念验收；不做 Lab / 项目交付。

## 章节地图

| 节 | 目录 | 标题 | 分钟 | 形式 | 可验收产出 |
|---|------|------|-----|------|-----------|
| 1 | `{sec}/` | {meta['title']} | 45′ | 视频+答题 | 日级概念验收通过 |

## 今日验收（GATE {day}）

- 已完成今日课节学习（视频上传后需观看）；
- 日级知识确认答题达到通过线；
- 能用自己的话复述本模块 1–2 个关键判断。
"""
    (day_dir / "README.md").write_text(readme, encoding="utf-8")

    lesson = f"""# {meta['title']}

## 教学目标

- 理解本模块在企业沟通特训中的位置与交付标准；
- 能在真实场景中做出可解释的判断，而不只是记住概念；
- 完成日级概念验收答题。

## 🎬 口播稿（待录制）

> 本模块视频尚未上传。请先阅读重点卡与情境题干，视频上线后可回看补齐。

## 学习说明

1. 视频区显示「待上传」时，可直接进入知识确认答题；
2. 答题以情境判断为主，请结合本周「启元新材」案例作答；
3. 错题请阅读解析后再重测。
"""
    (sec_dir / "lesson.md").write_text(lesson, encoding="utf-8")
    for name, body in {
        "practice.md": "# 练习\n\n本课以概念验收答题为主，无额外本地实操。\n",
        "resources.md": "# 资源\n\n口播视频待上传；讲义来自第三周企业沟通特训模块剧本。\n",
        "homework.md": "# 课后\n\n回顾今日错题解析，用一句话写下你在工作中会如何应用。\n",
        "ai-tutor.yaml": "role: coach\nprompts: []\n",
        "PPT_AND_NARRATION.md": "# PPT / 口播\n\n待制作。\n",
    }.items():
        (sec_dir / name).write_text(body, encoding="utf-8")

    # day-level quiz: up to 8; capsule quiz: remaining up to 6 (or mirror)
    day_quiz = quiz[:8]
    cap_quiz = quiz[:6] if len(quiz) >= 6 else quiz

    day_yaml = {
        "day": day,
        "delivery_mode": "video_quiz",
        "project": meta["project"],
        "project_brief": (
            f"第三周企业沟通特训 · 模块{meta['mod']}《{meta['title']}》。"
            "今日完成视频学习（待上传）与概念验收答题即可过闸。"
        ),
        "resources": [],
        "capsule_extra": {
            "c1": {
                "media": [
                    {
                        "kind": "video",
                        "title": f"口播课件 · {meta['title']}（待上传）",
                        "object_key": "",
                        "poster_key": "",
                        "duration_sec": 0,
                        "pending": True,
                    }
                ],
                "knowledge_cards": [
                    {
                        "id": f"w3-m{meta['mod']}-focus",
                        "term": meta["title"],
                        "plain": "企业沟通特训模块：用情境判断练出可执行、可验收、可汇报的沟通动作。",
                        "tag": "沟通",
                    },
                    {
                        "id": f"w3-m{meta['mod']}-video",
                        "term": "视频待上传",
                        "plain": "口播课件稍后补齐；可先完成概念验收答题。",
                        "tag": "状态",
                    },
                ],
                "quiz": cap_quiz,
                "tools": [
                    {"name": "情境判断", "note": "先分清目标、角色、风险与下一步"},
                ],
            }
        },
        "quiz": day_quiz,
        "nodes_project": f"今日复盘：{meta['title']}",
    }
    (day_dir / "day.yaml").write_text(
        yaml.safe_dump(day_yaml, allow_unicode=True, sort_keys=False, width=100),
        encoding="utf-8",
    )
    return day_dir


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--docx-dir", type=Path, required=True)
    ap.add_argument("--write-contracts", action="store_true")
    ap.add_argument("--dump-quizzes", type=Path, default=None)
    args = ap.parse_args()

    quizzes: dict[int, list] = {}
    for meta in MODULES:
        docx = find_docx(args.docx_dir, meta["file_prefix"])
        text = docx_text(docx)
        qs = extract_abcd(text)
        if meta["mod"] == 6 and len(qs) < 6:
            qs = extract_table_mod6(text)
        if len(qs) < 4:
            raise SystemExit(f"模块{meta['mod']} 解析题目过少：{len(qs)} from {docx.name}")
        quizzes[meta["mod"]] = qs[:12]
        day_dir = write_day(meta, quizzes[meta["mod"]])
        print(f"day-{meta['day']:02d} ← 模块{meta['mod']}《{meta['title']}》 quiz={len(quizzes[meta['mod']])} ({docx.name})")
        print(f"  wrote {day_dir.relative_to(ROOT)}")

    if args.dump_quizzes:
        args.dump_quizzes.write_text(json.dumps(quizzes, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.write_contracts:
        from services.author.bootcamp_sync import build_day_package

        out = ROOT / "contracts" / "examples"
        out.mkdir(parents=True, exist_ok=True)
        for meta in MODULES:
            pkg = build_day_package(meta["day"])
            path = out / f"day-{meta['day']:02d}-curriculum.yaml"
            path.write_text(
                yaml.safe_dump(pkg, allow_unicode=True, sort_keys=False, width=120),
                encoding="utf-8",
            )
            kinds = [n.get("type") for n in pkg.get("nodes") or []]
            print(
                f"contract day-{meta['day']:02d}: week={pkg.get('week')} nodes={kinds} "
                f"quiz={len(pkg.get('quiz', {}).get('questions') or [])}"
            )


if __name__ == "__main__":
    main()
