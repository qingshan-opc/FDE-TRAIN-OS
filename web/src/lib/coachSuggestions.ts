import type { Capsule, DayPackage, NodeState } from "./types";

const FALLBACK_QUESTIONS = [
  "这一步的验收标准是什么？",
  "我卡住了，应该先检查哪三件事？",
  "帮我看看思路有没有偏题",
];

const KIND_QUESTIONS: Record<string, string[]> = {
  learn: ["这一节的核心交付物是什么？", "知识卡片里哪一点最容易误解？"],
  lab: ["评测没过，最可能的原因有哪些？", "Agent Lab 里下一步该改哪个文件？"],
  project: ["企业任务提交前要自检哪些项？", "我的交付物和 rubric 差在哪里？"],
  quiz: ["这道题考查的是哪个知识点？", "我选错了，该回到哪一节复习？"],
  review: ["验收清单里还有哪一项没满足？", "怎样写反思才能通过评审？"],
};

export function buildCoachSuggestions(input: {
  day: DayPackage | null;
  node: NodeState | null;
  capsule: Capsule | null;
}): string[] {
  const { day, node, capsule } = input;
  const out: string[] = [];

  for (const q of capsule?.local_prep?.suggested_questions || []) {
    if (q && !out.includes(q)) out.push(q);
  }

  if (capsule?.title) {
    const t = `关于「${capsule.title}」，我还需要澄清什么？`;
    if (!out.includes(t)) out.push(t);
  }

  if (node?.kind) {
    for (const q of KIND_QUESTIONS[node.kind] || []) {
      if (!out.includes(q)) out.push(q);
    }
  }

  if (day?.project_brief) {
    const t = "今天的项目交付，老板最关心哪一点？";
    if (!out.includes(t)) out.push(t);
  }

  for (const q of FALLBACK_QUESTIONS) {
    if (out.length >= 6) break;
    if (!out.includes(q)) out.push(q);
  }

  return out.slice(0, 6);
}
