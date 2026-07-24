import { describe, expect, it } from "vitest";
import { buildTaskCards, dayTaskPath, primaryCtaLabel, resolveNextTarget, resolveTargetForDay, summarizeProgress } from "./taskTargets";
import type { DaySummary } from "./types";

const sampleDays: DaySummary[] = [
  {
    day: 1,
    title: "库存列表",
    source: "day-1.yaml",
    passed: 1,
    total: 5,
    locked: false,
    nodes: [
      { id: "d1-learn", title: "学习", kind: "learn", status: "passed" },
      { id: "d1-quiz", title: "测验", kind: "quiz", status: "available" },
      { id: "d1-lab", title: "Lab", kind: "lab", status: "locked" },
    ],
  },
  {
    day: 2,
    title: "Day 2",
    source: "day-2.yaml",
    passed: 0,
    total: 5,
    locked: true,
    nodes: [
      { id: "d2-learn", title: "学习", kind: "learn", status: "locked" },
    ],
  },
];

describe("taskTargets", () => {
  it("builds pending/done cards and marks first actionable as urgent", () => {
    const cards = buildTaskCards(sampleDays);
    expect(cards).toHaveLength(4);
    expect(cards.find((c) => c.nodeId === "d1-quiz")?.urgent).toBe(true);
    expect(cards.find((c) => c.nodeId === "d1-lab")?.locked).toBe(true);
    expect(cards.find((c) => c.nodeId === "d2-learn")?.locked).toBe(true);
  });

  it("resolves next target to first available node with node id", () => {
    const target = resolveNextTarget(sampleDays);
    expect(target).toEqual({ day: 1, nodeId: "d1-quiz", label: "测验" });
    expect(dayTaskPath(target!.day, target!.nodeId)).toBe("/app/day/1?node=d1-quiz");
  });

  it("resolves target for a specific day", () => {
    const target = resolveTargetForDay(sampleDays, 1);
    expect(target).toEqual({ day: 1, nodeId: "d1-quiz", label: "测验" });
    expect(resolveTargetForDay(sampleDays, 2)).toBeNull();
  });

  it("builds primary CTA label from next target", () => {
    const target = resolveNextTarget(sampleDays);
    expect(primaryCtaLabel(target)).toBe("继续：测验");
  });

  it("summarizes overall and week progress", () => {
    const summary = summarizeProgress(sampleDays, { "1": [1, 2] });
    expect(summary.passed).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.pct).toBe(10);
    expect(summary.weekLabel).toContain("第一天");
  });
});
