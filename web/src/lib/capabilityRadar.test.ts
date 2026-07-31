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
    expect(items[0].title).toContain("Lab");
    expect(items[0].href).toContain("/app/day/2");
  });
});
