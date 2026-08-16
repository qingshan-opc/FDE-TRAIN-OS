import { describe, expect, it } from "vitest";
import {
  resolveCapsuleResources,
  resourceActionLabel,
  resourceDownloadName,
  resourceIsDownload,
  type DayResource,
} from "./capsuleResources";

const pool: DayResource[] = [
  { id: "r1", title: "整日资料 A" },
  { id: "r2", title: "整日资料 B" },
];

describe("resolveCapsuleResources", () => {
  it("falls back to day pool when capsule has no bindings", () => {
    expect(resolveCapsuleResources({}, pool)).toEqual(pool);
  });

  it("treats explicit empty resource_ids as no resources", () => {
    expect(resolveCapsuleResources({ resource_ids: [] }, pool)).toEqual([]);
    expect(resolveCapsuleResources({ resource_ids: [], resources: [] }, pool)).toEqual([]);
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

describe("resource action labels", () => {
  it("labels zip/download resources as 下载", () => {
    const pack: DayResource = {
      id: "day1-agent-pack",
      title: "六岗位智能体提示词包",
      kind: "download",
      url: "/course-assets/bootcamp/day-01/agent-prompts/Day1_TRAE_六岗位智能体提示词.zip",
    };
    expect(resourceIsDownload(pack)).toBe(true);
    expect(resourceActionLabel(pack)).toBe("下载");
    expect(resourceDownloadName(pack)).toBe("Day1_TRAE_六岗位智能体提示词.zip");
  });

  it("labels diagrams and links as 打开", () => {
    expect(resourceActionLabel({ id: "map", title: "地图", kind: "diagram", url: "/x.svg" })).toBe("打开");
    expect(resourceActionLabel({ id: "trae", title: "TRAE", kind: "link", url: "https://www.trae.cn/ide/download" })).toBe(
      "打开",
    );
  });
});
