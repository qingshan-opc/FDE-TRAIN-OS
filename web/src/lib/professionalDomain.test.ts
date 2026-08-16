import { describe, expect, it } from "vitest";
import {
  DOMAIN_PLACEHOLDER,
  fillProfessionalDomain,
  memoryFromPracticeJson,
  memoryToPracticeJson,
  pickDomainFromPractices,
  resolveDomainLabel,
} from "./professionalDomain";

describe("professional domain memory", () => {
  it("resolves 其他 to the custom label", () => {
    expect(resolveDomainLabel("财务")).toBe("财务");
    expect(resolveDomainLabel("其他", "保险精算")).toBe("保险精算");
    expect(resolveDomainLabel("其他", "  ")).toBe("其他");
  });

  it("round-trips through practice json", () => {
    const json = memoryToPracticeJson({ option: "其他", other: "供应链", label: "供应链" });
    expect(memoryFromPracticeJson(json)).toEqual({ option: "其他", other: "供应链", label: "供应链" });
  });

  it("prefers c1 when several capsules have domain fields", () => {
    const mem = pickDomainFromPractices([
      { capsule_id: "c4", response_json: { professional_domain: "销售", professional_domain_label: "销售" } },
      { capsule_id: "c1", response_json: { professional_domain: "HR", professional_domain_label: "HR" } },
    ]);
    expect(mem?.label).toBe("HR");
  });

  it("fills later-lesson prompt placeholders", () => {
    const src = `我熟悉的专业领域是${DOMAIN_PLACEHOLDER}。请按 {{professional_domain}} 起草 PROJECT_BRIEF.md。方向：{{domain_example}}`;
    expect(fillProfessionalDomain(src, "财务")).toBe(
      "我熟悉的专业领域是财务。请按 财务 起草 PROJECT_BRIEF.md。方向：给部门负责人查看预算执行、费用趋势和异常支出",
    );
    expect(fillProfessionalDomain(src, "")).toContain("{{professional_domain}}");
    expect(fillProfessionalDomain("方向：{{domain_example}}", "供应链")).toContain("供应链");
  });
});
