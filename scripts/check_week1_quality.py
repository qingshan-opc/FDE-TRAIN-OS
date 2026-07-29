#!/usr/bin/env python3
"""Week-1 v0.7 课程质量机检（蓝本 docs/spec/0.4/curriculum-v0.7.md 第 7 节 Rubric 的可机检部分）。

检查 contracts/examples/day-01..05-curriculum.yaml：
  1. 结构闭环：五节点齐全；每胶囊有 content/practice/quiz；日级 quiz 6 题
  2. 口播稿规范：「同学们」开场；「」重点 3–6 处/节；段落短句（顿挫代理指标）
  3. 资源可落地：/course-assets/... 与 /docs/... 指向 class/ 下真实文件
  4. lab 链：rubric 可机检；inherited_files 逐日继承正确
  5. 考点覆盖：日级 quiz 解析非空；每节 capsule quiz ≥2 题

退出码非零 = 有 FAIL。 WARN 不阻塞。
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CLASS = ROOT / "class"
OUT = ROOT / "contracts" / "examples"

fails: list[str] = []
warns: list[str] = []


def fail(msg: str) -> None:
    fails.append(msg)


def warn(msg: str) -> None:
    warns.append(msg)


def check_day(path: Path) -> None:
    day = yaml.safe_load(path.read_text(encoding="utf-8"))
    tag = f"day-{day['day']:02d}"

    # 1. 结构闭环
    kinds = [n["type"] for n in day["nodes"]]
    if kinds != ["learn", "quiz", "lab", "project", "review"]:
        fail(f"{tag}: nodes 顺序/种类异常 {kinds}")
    caps = day["learn"]["capsules"]
    if not (4 <= len(caps) <= 6):
        warn(f"{tag}: 胶囊数 {len(caps)} 不在 4–6 区间")
    for cap in caps:
        ct = cap.get("content", "")
        cid = f"{tag}/{cap['id']}"
        if "同学们" not in ct:
            fail(f"{cid}: 口播稿未称「同学们」")
        emph = ct.count("「")
        if not (2 <= emph <= 8):
            warn(f"{cid}: 重点「」共 {emph} 处（期望 3–6 上下）")
        if not cap.get("practice"):
            fail(f"{cid}: 缺 practice")
        if not (cap.get("quiz") or {}).get("questions") or len(cap["quiz"]["questions"]) < 2:
            fail(f"{cid}: 节级 quiz <2 题")
        for q in (cap.get("quiz") or {}).get("questions", []):
            if not q.get("explain"):
                fail(f"{cid}: quiz 缺解析")
        if "media" in cap:
            warn(f"{cid}: 含 media（v0.7 第一周视频应暂缓）")
    dq = day["quiz"]["questions"]
    expected_quiz = 18 if day["day"] == 5 else 6  # Day5 v0.7.2 起日级快测 18 题
    if len(dq) != expected_quiz:
        fail(f"{tag}: 日级 quiz {len(dq)} 题（期望 {expected_quiz}）")

    # 2. 资源落地
    res_ids = {r["id"] for r in day.get("resources", [])}
    for r in day.get("resources", []):
        url = r.get("url") or ""
        if url.startswith("/course-assets/"):
            rel = url[len("/course-assets/"):]
            if not (CLASS / rel).exists():
                fail(f"{tag}: 资源 {r['id']} 指向缺失文件 class/{rel}")
        elif url.startswith("/docs/"):
            rel = url[len("/docs/"):]
            if not (CLASS / rel).exists():
                fail(f"{tag}: 资源 {r['id']} 指向缺失文件 class/{rel}（DocReader 映射 /course-assets）")
        elif not url:
            warn(f"{tag}: 资源 {r['id']} 无 url")
    for cap in caps:
        for rid in cap.get("resource_ids", []):
            if rid not in res_ids:
                fail(f"{tag}/{cap['id']}: resource_ids 引用未定义资源 {rid}")

    # 3. lab 链
    lab = day["lab"]
    runner = lab.get("runner")
    day_n = day["day"]
    if runner == "agent":
        if not lab.get("agent", {}).get("prompt_template"):
            fail(f"{tag}: lab runner=agent 缺 prompt_template")
    elif runner == "sim":
        if not lab.get("sim_kind") or not lab.get("rubric"):
            fail(f"{tag}: lab runner=sim 缺 sim_kind/rubric")
    else:
        fail(f"{tag}: lab runner 异常 {runner}")
    for item in lab.get("rubric", []):
        if item.get("check") not in ("file_exists", "text_contains", "command_sequence", "port_listening", "file_contains"):
            fail(f"{tag}: rubric 含未知 check {item.get('check')}")
    if runner == "agent" and day_n > 1:
        prev = yaml.safe_load((OUT / f"day-{day_n-1:02d}-curriculum.yaml").read_text(encoding="utf-8"))
        for f in prev["lab"].get("primary_files", []):
            if f not in lab.get("inherited_files", []):
                fail(f"{tag}: inherited_files 未继承 {f}")


def main() -> int:
    for d in range(1, 6):
        p = OUT / f"day-{d:02d}-curriculum.yaml"
        if not p.exists():
            fail(f"缺 {p.name}")
            continue
        check_day(p)
    for w in warns:
        print(f"WARN  {w}")
    for f in fails:
        print(f"FAIL  {f}")
    print(f"\n{len(fails)} FAIL · {len(warns)} WARN")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
