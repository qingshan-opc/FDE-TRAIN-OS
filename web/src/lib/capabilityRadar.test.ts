import { describe, expect, it } from "vitest";
import { buildCapabilityRadar, buildRecentActivity, commandAcceptanceScore } from "./capabilityRadar";

describe("buildCapabilityRadar", () => {
  it("returns six axes with scores", () => {
    const axes = buildCapabilityRadar(
      {
        learner_id: "u1",
        cert_id: "CERT-1",
        disclaimer: "",
        capability_tags: ["agent", "sim", "sql_sandbox"],
        evidence_count: 3,
        tracks: { agent: true, sim: false },
      },
      [{ kind: "lab", day: 1, capability_tags: ["agent", "day:1"] }],
    );
    expect(axes).toHaveLength(6);
    expect(axes.find((a) => a.key === "agent")?.score).toBeGreaterThan(50);
  });
});

describe("commandAcceptanceScore", () => {
  it("counts passed command days out of five", () => {
    expect(
      commandAcceptanceScore(
        { capability_tags: ["command:day:1", "command:day:2"] } as import("./types").Passport,
        [],
      ),
    ).toBe(40);
  });
});

describe("buildRecentActivity", () => {
  it("maps evidence rows to activity items", () => {
    const items = buildRecentActivity([
      { kind: "lab", day: 2, node_id: "d2-lab", ts: new Date().toISOString() },
    ]);
    expect(items[0].title).toContain("第二天");
    expect(items[0].subtitle).toContain("Lab");
    expect(items[0].href).toBe("/app/day/2?node=d2-lab");
  });

  it("uses Chinese day titles and hides coach hashes", () => {
    const items = buildRecentActivity(
      [{ kind: "coach", day: 11, node_id: "coach-4203cd68490e", ts: new Date().toISOString() }],
      6,
      [{ day: 11, title: "收官：把智能体接到驾驶舱", project: "收官：把智能体接到驾驶舱" }],
    );
    expect(items[0].title).toBe("收官：把智能体接到驾驶舱");
    expect(items[0].subtitle).toContain("教练辅导");
    expect(items[0].subtitle).not.toContain("coach-");
    expect(items[0].href).toBe("/app/day/11");
  });

  it("prefers project when package title is Day N", () => {
    const items = buildRecentActivity(
      [{ kind: "agent", day: 1, node_id: "d1-lab", ts: new Date().toISOString() }],
      6,
      [{ day: 1, title: "Day 1", project: "第一次指挥 AI 开发" }],
    );
    expect(items[0].title).toBe("第一次指挥 AI 开发");
    expect(items[0].subtitle).not.toContain("d1-lab");
  });
});
