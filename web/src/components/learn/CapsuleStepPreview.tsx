import { useMemo, useState } from "react";
import { Typography } from "antd";
import { CapsuleMediaStack } from "../CapsuleMedia";
import type { CapsuleLocalPrep, CapsuleMedia, DayPackage, DayResource, KnowledgeCard } from "../../lib/types";
import { LocalPrepPanel } from "./LocalPrepPanel";
import {
  buildLearnSteps,
  GlossaryTermsPanel,
  KnowledgeCardsStep,
  stepLabel,
  type LearnStep,
} from "./KnowledgeCardsStep";

function PreviewProse({ content }: { content: string }) {
  return (
    <div className="capsule-prose">
      {content.split(/\n{2,}/).map((block, i) => {
        const text = block.trim();
        if (!text) return null;
        const firstLine = text.split("\n")[0]?.trim() || "";
        if (/^【.+】$/.test(firstLine)) {
          const [head, ...rest] = text.split("\n");
          return (
            <section key={i} style={{ marginBottom: 12 }}>
              <Typography.Title level={5} style={{ marginBottom: 4 }}>
                {head.replace(/[【】]/g, "")}
              </Typography.Title>
              {rest.join("\n").trim() ? <Typography.Paragraph>{rest.join("\n").trim()}</Typography.Paragraph> : null}
            </section>
          );
        }
        return (
          <Typography.Paragraph key={i} style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Typography.Paragraph>
        );
      })}
    </div>
  );
}

export function CapsuleStepPreview({
  capsule,
  campId,
  day,
  resources = [],
}: {
  capsule: {
    id: string;
    title: string;
    minutes?: number;
    content?: string;
    practice?: unknown;
    media?: CapsuleMedia[];
    knowledge_cards?: KnowledgeCard[];
    glossary_terms?: KnowledgeCard[];
    quiz?: { questions?: Array<{ q: string; options: string[] }> };
    lab?: { sim_kind?: string };
    local_prep?: CapsuleLocalPrep;
  };
  campId?: string | null;
  day: number;
  resources?: DayResource[];
}) {
  const steps = useMemo(() => buildLearnSteps(capsule), [capsule]);
  const [step, setStep] = useState<LearnStep>("video");
  const effectiveStep = steps.some((s) => s.id === step) ? step : steps[0]?.id || "video";
  const currentIdx = Math.max(0, steps.findIndex((s) => s.id === effectiveStep));
  const nextStep = currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;
  const knowledgeCards = capsule.knowledge_cards || [];
  const glossaryTerms = capsule.glossary_terms || [];
  const quizQuestions = capsule.quiz?.questions || [];
  const media = (capsule.media || []).filter((m) => m.object_key || m.pending);

  return (
    <div className="learn-shell learn-shell--preview">
      <header className="learn-article-head">
        <h3>{capsule.title}</h3>
        <Typography.Text type="secondary">学员预览（只读，不写进度）</Typography.Text>
      </header>

      <div className="learn-steps" role="tablist">
        {steps.map((s, idx) => {
          const isActive = effectiveStep === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`learn-step-card ${isActive ? "is-active" : ""}`}
              onClick={() => setStep(s.id)}
            >
              <span className="learn-step-kicker num">
                第 {idx + 1} 步 · {s.minutes}分钟
              </span>
              <span className="learn-step-title">{stepLabel(s.id)}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`learn-step-panel${effectiveStep === "video" || effectiveStep === "cards" ? " is-wide" : ""}`}
        role="tabpanel"
      >
        {effectiveStep === "video" && (
          <div className="learn-video-stage">
            {media.length > 0 ? (
              <CapsuleMediaStack key={capsule.id} items={media} campId={campId} />
            ) : (
              <PreviewProse content={capsule.content || "（本节暂无正文）"} />
            )}
            {glossaryTerms.length > 0 && (
              <div className="learn-video-below has-glossary">
                <GlossaryTermsPanel terms={glossaryTerms} />
              </div>
            )}
          </div>
        )}

        {effectiveStep === "cards" && <KnowledgeCardsStep cards={knowledgeCards} />}

        {effectiveStep === "quiz" && (
          <div>
            {quizQuestions.length > 0 && (
              <ol style={{ paddingLeft: 18 }}>
                {quizQuestions.map((q, i) => (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <strong>{q.q}</strong>
                    <ul>
                      {q.options.map((o, j) => (
                        <li key={j}>{o}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
            {capsule.practice ? (
              <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
                {typeof capsule.practice === "string" ? capsule.practice : JSON.stringify(capsule.practice)}
              </Typography.Paragraph>
            ) : null}
          </div>
        )}

        {effectiveStep === "lab" && (
          <Typography.Text type="secondary">本节含仿真实验（预览不启动终端）。</Typography.Text>
        )}

        {effectiveStep === "local_prep" && capsule.local_prep && (
          <LocalPrepPanel
            day={{ day } as unknown as DayPackage}
            capsuleId={capsule.id}
            prep={capsule.local_prep}
            resources={resources}
            disabled
          />
        )}

        {effectiveStep === "local_prep" && !capsule.local_prep && (
          <Typography.Paragraph type="secondary">（本节未配置本地实操）</Typography.Paragraph>
        )}

        {effectiveStep === "submit" && (
          <Typography.Paragraph type="secondary">学员在此步确认并完成本节学习节点。</Typography.Paragraph>
        )}

        <div className="learn-step-footer">
          {nextStep ? (
            <button type="button" className="btn-primary" onClick={() => setStep(nextStep.id)}>
              下一步：{stepLabel(nextStep.id)}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
