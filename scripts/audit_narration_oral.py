#!/usr/bin/env python3
"""Audit bootcamp narration oral quality; write narration-review-index.md."""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BC = ROOT / "class" / "bootcamp"
OUT = ROOT / "class" / "quality" / "narration-review-index.md"
sys.path.insert(0, str(ROOT / "scripts"))
from bootcamp_sections import section_dirs, section_path  # noqa: E402

ORAL_MARKERS = ("同学们", "咱们", "对吧", "嘛", "呢")
GENERIC_SLUGS = {"core", "detail", "extra", "end"}
DAY_PAT = re.compile(r"\bDay\s*\d+|Day\d+\b|Week\s*\d+", re.I)
CN_DAY = re.compile(r"第\s*[一二三四五六七八九十\d]+\s*天")


@dataclass
class SectionAudit:
    day: int
    sec: str
    name: str
    segments: int = 0
    generic_slugs: list[str] = field(default_factory=list)
    day_hits: list[str] = field(default_factory=list)
    oral_count: int = 0
    has_ppt_review: bool = False
    ppt_path: str = ""
    narr_dir: str = ""
    review_path: str = ""

    @property
    def ok(self) -> bool:
        return (
            self.segments >= 3
            and not self.generic_slugs
            and not self.day_hits
            and self.oral_count >= self.segments
            and self.has_ppt_review
        )


def audit_section(day: int, sec: str) -> SectionAudit:
    sd = section_path(day, sec)
    rel = sd.relative_to(ROOT)
    a = SectionAudit(day=day, sec=sec, name=sd.name)
    a.ppt_path = str(rel / "video/index.html")
    a.narr_dir = str(rel / "video/scripts/narration")
    a.review_path = str(rel / "PPT_AND_NARRATION.md")
    a.has_ppt_review = (sd / "PPT_AND_NARRATION.md").is_file()

    narr = sd / "video/scripts/narration"
    manifest = narr / "manifest.json"
    if not manifest.is_file():
        return a

    items = json.loads(manifest.read_text(encoding="utf-8"))
    a.segments = len(items)
    for item in items:
        sid = item.get("id", "")
        slug = sid.split("-", 1)[-1] if "-" in sid else sid
        if slug in GENERIC_SLUGS:
            a.generic_slugs.append(sid)
        fpath = narr / item.get("file", "")
        if not fpath.is_file():
            continue
        text = fpath.read_text(encoding="utf-8")
        if DAY_PAT.search(text):
            a.day_hits.append(item.get("file", sid))
        if any(m in text for m in ORAL_MARKERS):
            a.oral_count += 1
    return a


def day_cn(n: int) -> str:
    nums = "零一二三四五六七八九十"
    if n <= 10:
        return f"第{nums[n]}天" if n < 10 else "第十天"
    return f"第{n}天"


def write_index(audits: list[SectionAudit], report_path: Path) -> None:
    lines = [
        "# 口播过稿索引（第五天–第十天）",
        "",
        "> 打开各节 `PPT_AND_NARRATION.md` 逐段朗读验收。",
        "> 生成：`scripts/audit_narration_oral.py`",
        "",
        "| 天 | 节 | 段数 | PPT | 分词稿目录 | 对照稿 | 状态 |",
        "|----|-----|------|-----|-----------|--------|------|",
    ]
    for a in audits:
        status = "✅" if a.ok else "⚠️"
        issues = []
        if a.generic_slugs:
            issues.append("通用slug")
        if a.day_hits:
            issues.append("含DayN")
        if a.oral_count < a.segments:
            issues.append("缺口语词")
        if not a.has_ppt_review:
            issues.append("缺对照稿")
        if issues:
            status = "⚠️ " + ",".join(issues)
        lines.append(
            f"| {day_cn(a.day)} | S{a.sec} | {a.segments} | `{a.ppt_path}` | `{a.narr_dir}/` | `{a.review_path}` | {status} |"
        )
    lines.extend(["", f"合计 {len(audits)} 节 · 通过 {sum(1 for x in audits if x.ok)} 节", ""])
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-day", type=int, default=5)
    ap.add_argument("--to-day", type=int, default=10)
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    audits: list[SectionAudit] = []
    for day in range(args.from_day, args.to_day + 1):
        for sec in section_dirs(day):
            audits.append(audit_section(day, sec))

    write_index(audits, Path(args.out))
    bad = [a for a in audits if not a.ok]
    print(f"wrote {args.out} ({len(audits)} sections, {len(bad)} need work)")
    for a in bad[:10]:
        print(f"  d{a.day}s{a.sec}: gen={a.generic_slugs} day={a.day_hits} oral={a.oral_count}/{a.segments} ppt={a.has_ppt_review}")


if __name__ == "__main__":
    main()
