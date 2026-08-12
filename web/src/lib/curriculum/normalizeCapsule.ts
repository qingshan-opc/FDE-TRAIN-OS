/** Normalize bootcamp / API capsule shapes for the learner UI. */

import type { Capsule, CapsulePracticeSpec } from "../types";

export type QuizQuestion = {
  q: string;
  options: string[];
  answer?: number;
  explain?: string;
};

/**
 * Bootcamp YAML often stores quiz as a list of tuples:
 *   [question, [options...], answerIndex, explain?]
 * while the typed curriculum uses `{ questions: [{ q, options, answer, explain }] }`.
 */
export function normalizeQuizQuestions(quiz: Capsule["quiz"] | unknown): QuizQuestion[] {
  if (!quiz) return [];

  if (typeof quiz === "object" && !Array.isArray(quiz)) {
    const qs = (quiz as { questions?: unknown }).questions;
    if (!Array.isArray(qs)) return [];
    return qs.map(coerceQuestion).filter((q): q is QuizQuestion => Boolean(q));
  }

  if (Array.isArray(quiz)) {
    return quiz.map(coerceQuestion).filter((q): q is QuizQuestion => Boolean(q));
  }

  return [];
}

function coerceQuestion(item: unknown): QuizQuestion | null {
  if (!item) return null;
  if (Array.isArray(item)) {
    const [q, options, answer, explain] = item;
    if (typeof q !== "string" || !q.trim()) return null;
    const opts = Array.isArray(options) ? options.map((o) => String(o)) : [];
    if (!opts.length) return null;
    return {
      q: q.trim(),
      options: opts,
      answer: typeof answer === "number" ? answer : undefined,
      explain: typeof explain === "string" && explain.trim() ? explain.trim() : undefined,
    };
  }
  if (typeof item === "object") {
    const row = item as { q?: unknown; question?: unknown; options?: unknown; answer?: unknown; explain?: unknown };
    const q = String(row.q ?? row.question ?? "").trim();
    const opts = Array.isArray(row.options) ? row.options.map((o) => String(o)) : [];
    if (!q || !opts.length) return null;
    return {
      q,
      options: opts,
      answer: typeof row.answer === "number" ? row.answer : undefined,
      explain: typeof row.explain === "string" && row.explain.trim() ? row.explain.trim() : undefined,
    };
  }
  return null;
}

/** `practice` may be a plain string (required text/checklist) or a structured spec. */
export function normalizePractice(practice: Capsule["practice"]): CapsulePracticeSpec | null {
  if (!practice) return null;
  if (typeof practice === "string") {
    const trimmed = practice.trim();
    if (!trimmed) return null;
    const checklistish = /\[\s*[xX ]\s*\]/.test(trimmed) || /^完成标志[：:]/m.test(trimmed);
    return {
      prompt: trimmed,
      input_type: checklistish ? "checklist" : "text",
      required: true,
    };
  }
  if (typeof practice === "object" && practice.prompt) {
    return {
      prompt: practice.prompt,
      input_type: practice.input_type || "text",
      required: Boolean(practice.required),
    };
  }
  return null;
}

/** Split checklist prompts that use `[ ] item；[ ] item` on one line. */
export function checklistItemsFromPrompt(prompt: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const item = raw.replace(/^[;；、.\s]+|[;；、.\s]+$/g, "").trim();
    if (!item || seen.has(item)) return;
    // Headings / section labels are not checklist rows.
    if (/^(#{1,6}\s|完成标志|手工检查清单|学员验收清单|过关标准)/.test(item)) return;
    seen.add(item);
    out.push(item);
  };

  // Prefer real checkbox lines — avoids treating the task brief as item #1
  // and avoids duplicating the same rows when generators append 完成标志 twice.
  for (const raw of prompt.split("\n")) {
    const m = raw.match(/^\s*[-*]?\s*\[\s*[xX ]\s*\]\s*(.+)$/);
    if (m) push(m[1]);
  }
  if (out.length) return out;

  const body = prompt.replace(/^完成标志[：:]\s*/m, "").trim();
  const byMarker = body.split(/\[\s*[xX ]\s*\]/).slice(1);
  for (const s of byMarker) push(s);
  if (out.length) return out;
  return body ? [body] : [];
}
