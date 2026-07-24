import { useCallback, useEffect, useMemo, useState } from "react";
import { practiceApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../Toast";
import type { CapsuleLocalPrep, DayPackage, DayResource } from "../../lib/types";

export function LocalPrepPanel({
  day,
  capsuleId,
  prep,
  resources,
  disabled,
}: {
  day: DayPackage;
  capsuleId: string;
  prep: CapsuleLocalPrep;
  resources: DayResource[];
  disabled?: boolean;
}) {
  const { campId } = useAuth();
  const toast = useToast();
  const checklist = prep.checklist || [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const template = useMemo(() => {
    if (!prep.template_resource_id) return null;
    return resources.find((r) => r.id === prep.template_resource_id) || null;
  }, [prep.template_resource_id, resources]);

  const loadChecked = useCallback(async () => {
    if (!campId) return;
    try {
      const res = await practiceApi.list({ camp_id: campId, day: day.day });
      const row = res.items.find((it) => it.capsule_id === capsuleId);
      const saved = row?.response_json?.local_prep_checked;
      if (Array.isArray(saved)) {
        setChecked(new Set(saved.filter((n): n is number => typeof n === "number")));
      }
    } catch {
      /* optional */
    }
  }, [campId, day.day, capsuleId]);

  useEffect(() => {
    void loadChecked();
  }, [loadChecked]);

  const persistChecked = async (next: Set<number>) => {
    if (!campId) return;
    setSaving(true);
    try {
      await practiceApi.save({
        camp_id: campId,
        day: day.day,
        capsule_id: capsuleId,
        response_text: "",
        response_json: { local_prep_checked: [...next] },
        status: "draft",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (idx: number) => {
    if (disabled) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      void persistChecked(next);
      return next;
    });
  };

  const copyPrompt = async () => {
    const text = prep.codex_prompt?.trim();
    if (!text) {
      toast.push("暂无 Codex 任务上下文", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.push("已复制，请粘贴到本机 Codex 并加载 fde-local-prep Skill", "success");
    } catch {
      toast.push("复制失败，请手动选择文本复制", "error");
    }
  };

  return (
    <div className="local-prep-panel">
      <p className="local-prep-lead muted">
        平台提供企业背景与验收边界；请在本机 Codex 完成分析与表达，最终判断须由你确认。
      </p>
      <div className="local-prep-grid">
        <section className="local-prep-card">
          <h4>准备工作</h4>
          {checklist.length === 0 ? (
            <p className="muted">暂无 checklist，可直接复制右侧任务上下文。</p>
          ) : (
            <ul className="local-prep-checklist">
              {checklist.map((item, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={checked.has(i)} disabled={disabled || saving} onChange={() => toggle(i)} />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="local-prep-card local-prep-card--codex">
          <h4>复制给 Codex 的任务上下文</h4>
          {prep.skill_id && <p className="local-prep-skill mono">Skill · {prep.skill_id}</p>}
          <pre className="local-prep-prompt">{prep.codex_prompt?.trim() || "（教研尚未配置 prompt）"}</pre>
          <div className="local-prep-actions">
            <button type="button" className="btn-primary" disabled={disabled || !prep.codex_prompt} onClick={() => void copyPrompt()}>
              复制任务背景
            </button>
            {template?.url && (
              <a className="btn-ghost" href={template.url} target="_blank" rel="noreferrer">
                下载任务模板
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
