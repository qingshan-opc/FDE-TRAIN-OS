import { describe, expect, it } from "vitest";
import { resolveCapsuleResources, type DayResource } from "./capsuleResources";

const pool: DayResource[] = [
  { id: "r1", title: "整日资料 A" },
  { id: "r2", title: "整日资料 B" },
];

describe("resolveCapsuleResources", () => {
  it("falls back to day pool when capsule has no bindings", () => {
    expect(resolveCapsuleResources({}, pool)).toEqual(pool);
    expect(resolveCapsuleResources({ resource_ids: [], resources: [] }, pool)).toEqual(pool);
  });

  it("merges inline resources and pool refs by id", () => {
    const result = resolveCapsuleResources(
      {
        resource_ids: ["r1"],
        resources: [{ id: "cap-r", title: "节内资料" }],
      },
      pool,
    );
    expect(result.map((r) => r.id)).toEqual(["cap-r", "r1"]);
  });

  it("dedupes by resource id (inline wins order)", () => {
    const result = resolveCapsuleResources(
      {
        resource_ids: ["r1"],
        resources: [{ id: "r1", title: "节内覆盖" }],
      },
      pool,
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("节内覆盖");
  });
});
