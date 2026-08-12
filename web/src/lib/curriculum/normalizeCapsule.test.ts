import { describe, expect, it } from "vitest";
import {
  checklistItemsFromPrompt,
  normalizePractice,
  normalizeQuizQuestions,
} from "./normalizeCapsule";

describe("normalizeQuizQuestions", () => {
  it("reads bootcamp tuple lists", () => {
    const qs = normalizeQuizQuestions([
      ["题干？", ["A", "B", "C"], 1, "解析"],
      ["第二题？", ["X", "Y"], 0],
    ]);
    expect(qs).toHaveLength(2);
    expect(qs[0]).toEqual({ q: "题干？", options: ["A", "B", "C"], answer: 1, explain: "解析" });
    expect(qs[1].answer).toBe(0);
  });

  it("reads { questions: [...] } curriculum shape", () => {
    const qs = normalizeQuizQuestions({
      questions: [{ q: "Q", options: ["1", "2"], answer: 0 }],
    });
    expect(qs).toEqual([{ q: "Q", options: ["1", "2"], answer: 0, explain: undefined }]);
  });
});

describe("normalizePractice + checklist", () => {
  it("detects [ ] checklist prompts", () => {
    const spec = normalizePractice(
      "完成标志：[ ] 一项；[ ] 二项；[ ] 三项。",
    );
    expect(spec?.input_type).toBe("checklist");
    expect(spec?.required).toBe(true);
    expect(checklistItemsFromPrompt(spec!.prompt)).toEqual(["一项", "二项", "三项。"]);
  });

  it("dedupes checklist rows and ignores task-brief preamble", () => {
    const prompt = `目标：在应用里跑通多轮对话。

### 手工检查清单

- [ ] Key 不在前端；环境变量或教务网关
- [ ] 助手位可 ≥3 轮连续对话

完成标志：
[ ] Key 不在前端；环境变量或教务网关
[ ] 助手位可 ≥3 轮连续对话
[ ] 四层名称顺序正确`;
    expect(checklistItemsFromPrompt(prompt)).toEqual([
      "Key 不在前端；环境变量或教务网关",
      "助手位可 ≥3 轮连续对话",
      "四层名称顺序正确",
    ]);
  });
});
