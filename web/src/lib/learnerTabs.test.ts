import { describe, expect, it } from "vitest";
import { LEARNER_TABS, learnerTabId } from "./learnerTabs";

describe("learnerTabId", () => {
  it("maps shop to 首页", () => {
    expect(learnerTabId("/app/shop")).toBe("home");
    expect(learnerTabId("/app/shop?pay=1")).toBe("home");
  });

  it("maps learn routes to 学习", () => {
    expect(learnerTabId("/app")).toBe("learn");
    expect(learnerTabId("/app/courses")).toBe("learn");
    expect(learnerTabId("/app/day/1")).toBe("learn");
    expect(learnerTabId("/app/sim/1/cap")).toBe("learn");
  });

  it("maps invite to 邀请", () => {
    expect(learnerTabId("/app/invite")).toBe("invite");
  });

  it("nests identity and certificates under 我的", () => {
    expect(learnerTabId("/app/profile")).toBe("me");
    expect(learnerTabId("/app/identity")).toBe("me");
    expect(learnerTabId("/app/certificates")).toBe("me");
  });

  it("ignores author and public routes", () => {
    expect(learnerTabId("/author")).toBeNull();
    expect(learnerTabId("/login")).toBeNull();
    expect(learnerTabId("/")).toBeNull();
  });

  it("keeps four tabs", () => {
    expect(LEARNER_TABS.map((t) => t.label)).toEqual(["首页", "学习", "邀请", "我的"]);
  });
});
