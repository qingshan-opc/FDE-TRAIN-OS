import { useState } from "react";
import type { KnowledgeCard } from "../../lib/types";

/** 可点击翻开的知识卡片墙——点一张看人话解释 + 细节。 */
export function KnowledgeCardsStep({ cards }: { cards: KnowledgeCard[] }) {
  const [openId, setOpenId] = useState<string | null>(cards[0]?.id ?? null);
  if (!cards.length) return <p className="muted">本节暂无知识卡片。</p>;
  const active = cards.find((c) => c.id === openId) || cards[0];
  return (
    <section className="knowledge-cards" aria-label="知识卡片">
      <header className="knowledge-cards-head">
        <h4>点一张卡片，搞懂一个概念</h4>
        <p className="muted">先过一遍词条，再去做知识确认——别死记，能用自己的话复述就算会了。</p>
      </header>
      <div className="knowledge-cards-grid" role="list">
        {cards.map((c) => {
          const on = c.id === active.id;
          return (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className={`knowledge-card-tile${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => setOpenId(c.id)}
            >
              {c.tag ? <span className="knowledge-card-tag">{c.tag}</span> : null}
              <strong>{c.term}</strong>
              <span className="muted">{c.plain}</span>
            </button>
          );
        })}
      </div>
      <aside className="knowledge-card-detail" aria-live="polite">
        <div className="knowledge-card-detail-kicker">
          {active.tag ? <span className="knowledge-card-tag">{active.tag}</span> : null}
          <strong>{active.term}</strong>
        </div>
        <p className="knowledge-card-plain">{active.plain}</p>
        {active.detail ? <p className="knowledge-card-more">{active.detail}</p> : null}
      </aside>
    </section>
  );
}

/** 本节名词解释（点词看释义）。embedded：嵌在底部 tab 内时去掉外框与标题。 */
export function GlossaryTermsPanel({
  terms,
  embedded = false,
}: {
  terms: KnowledgeCard[];
  embedded?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(terms[0]?.id ?? null);
  if (!terms.length) return null;
  const active = terms.find((t) => t.id === openId) || terms[0];
  return (
    <section
      className={`glossary-terms${embedded ? " is-embedded" : ""}`}
      aria-label="名词解释"
    >
      {!embedded && (
        <header className="glossary-terms-head">
          <h4>名词解释</h4>
          <p className="muted">本节课里出现的词，点一下看人话。</p>
        </header>
      )}
      {embedded && <p className="muted glossary-terms-hint">本节课里出现的词，点一下看人话。</p>}
      <div className="glossary-terms-list" role="list">
        {terms.map((t) => {
          const on = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              role="listitem"
              className={`glossary-term-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => setOpenId(t.id)}
            >
              {t.term}
            </button>
          );
        })}
      </div>
      <aside className="glossary-term-detail" aria-live="polite">
        <strong>{active.term}</strong>
        <p>{active.plain}</p>
        {active.detail ? <p className="muted">{active.detail}</p> : null}
      </aside>
    </section>
  );
}

export type LearnStep = "video" | "cards" | "quiz" | "lab" | "local_prep" | "submit";

export function stepLabel(id: LearnStep): string {
  switch (id) {
    case "video":
      return "课件讲解";
    case "cards":
      return "知识卡片";
    case "quiz":
      return "知识确认";
    case "lab":
      return "实验";
    case "local_prep":
      return "本地实操";
    case "submit":
      return "提交验收";
    default:
      return id;
  }
}

export function buildLearnSteps(capsule: {
  media?: Array<{ duration_sec?: number }>;
  minutes?: number;
  knowledge_cards?: KnowledgeCard[];
  quiz?: { questions?: unknown[] };
  practice?: unknown;
  lab?: { sim_kind?: string };
  local_prep?: { codex_prompt?: string; checklist?: string[] };
}): { id: LearnStep; minutes: number }[] {
  const list: { id: LearnStep; minutes: number }[] = [];
  const dur = (capsule.media || []).find((m) => m.duration_sec)?.duration_sec;
  list.push({ id: "video", minutes: dur ? Math.max(1, Math.ceil(dur / 60)) : capsule.minutes || 5 });
  const cards = capsule.knowledge_cards || [];
  if (cards.length > 0) list.push({ id: "cards", minutes: 3 });
  const quizQuestions = capsule.quiz?.questions || [];
  const hasPractice = Boolean(capsule.practice);
  if (quizQuestions.length > 0 || hasPractice) list.push({ id: "quiz", minutes: 3 });
  if (capsule.lab?.sim_kind) list.push({ id: "lab", minutes: 10 });
  if (capsule.local_prep?.codex_prompt || (capsule.local_prep?.checklist || []).length) {
    list.push({ id: "local_prep", minutes: 8 });
  }
  list.push({ id: "submit", minutes: 2 });
  return list;
}
