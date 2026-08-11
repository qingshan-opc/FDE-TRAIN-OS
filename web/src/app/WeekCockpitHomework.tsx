import { useCallback, useEffect, useState } from "react";
import { practiceApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { WEEK1_COCKPIT_HOMEWORK } from "../content/week1CockpitHomework";

const CAPSULE_ID = "week1-cockpit-hw";

export function WeekCockpitHomework({
  anchorDay,
  onCompleted,
}: {
  /** Persist against the last day of week 1 (usually Saturday / day 6). */
  anchorDay: number;
  onCompleted?: () => void;
}) {
  const { campId } = useAuth();
  const toast = useToast();
  const hw = WEEK1_COCKPIT_HOMEWORK;
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!campId) return;
    try {
      const res = await practiceApi.list({ camp_id: campId, day: anchorDay });
      const row = res.items.find((it) => it.capsule_id === CAPSULE_ID);
      const saved = row?.response_json?.local_prep_checked;
      if (Array.isArray(saved)) {
        setChecked(new Set(saved.filter((n): n is number => typeof n === "number")));
      }
      if (row?.status === "submitted") setSubmitted(true);
    } catch {
      /* optional */
    }
  }, [campId, anchorDay]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: Set<number>, status: "draft" | "submitted" = "draft") => {
    if (!campId) return;
    setSaving(true);
    try {
      await practiceApi.save({
        camp_id: campId,
        day: anchorDay,
        capsule_id: CAPSULE_ID,
        response_text: status === "submitted" ? "week1-cockpit-done" : "",
        response_json: { local_prep_checked: [...next] },
        status,
      });
      if (status === "submitted") {
        setSubmitted(true);
        toast.push("第一周作业已标记完成", "success");
        onCompleted?.();
      }
    } catch {
      toast.push("保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (idx: number) => {
    if (submitted) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      void persist(next, "draft");
      return next;
    });
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(hw.codex_prompt);
      toast.push("提示词已复制，粘贴到编码 AI 即可", "success");
    } catch {
      toast.push("复制失败，请手动选择文本", "error");
    }
  };

  return (
    <div className="week-hw panel">
      <p className="eyebrow">{hw.subtitle}</p>
      <h2 style={{ marginTop: 4 }}>{hw.title}</h2>
      <p className="muted">{hw.lead}</p>

      <section className="local-prep-panel" style={{ marginTop: 16 }}>
        <div className="local-prep-grid">
          <section className="local-prep-card">
            <h4>验收清单</h4>
            <ul className="local-prep-checklist">
              {hw.checklist.map((item, i) => (
                <li key={i}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      disabled={submitted || saving}
                      onChange={() => toggle(i)}
                    />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </section>
          <section className="local-prep-card local-prep-card--codex">
            <h4>一键粘贴提示词</h4>
            <p className="muted" style={{ fontSize: 13 }}>
              整份复制后粘贴到 Cursor / anyCode / Claude Code。
            </p>
            <pre className="local-prep-prompt">{hw.codex_prompt}</pre>
            <button type="button" className="btn primary" onClick={() => void copyPrompt()}>
              复制提示词
            </button>
          </section>
        </div>
      </section>

      <div className="row" style={{ marginTop: 20, gap: 12 }}>
        <button
          type="button"
          className="btn primary"
          disabled={submitted || saving}
          onClick={() => void persist(checked, "submitted")}
        >
          {submitted ? "已完成" : "我已做完，标记完成"}
        </button>
        {submitted ? <span className="muted">可随时回看提示词；不挡第二周开课。</span> : null}
      </div>
    </div>
  );
}
