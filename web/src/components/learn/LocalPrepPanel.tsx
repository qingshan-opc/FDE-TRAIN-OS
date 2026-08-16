import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { kbApi, practiceApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../Toast";
import type { CapsuleLocalPrep, DayPackage, DayResource } from "../../lib/types";
import { resourceDownloadName } from "../../lib/curriculum/capsuleResources";
import {
  DEFAULT_DOMAIN_OPTIONS,
  PROFESSIONAL_DOMAIN_CAPSULE_ID,
  PROFESSIONAL_DOMAIN_DAY,
  PROFESSIONAL_DOMAIN_OTHER,
  domainMemoryContent,
  fillProfessionalDomain,
  memoryToPracticeJson,
  pickDomainFromPractices,
  readCachedDomain,
  resolveDomainLabel,
  writeCachedDomain,
  type ProfessionalDomainMemory,
} from "../../lib/professionalDomain";

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
  const hasPrompt = Boolean(prep.codex_prompt?.trim());
  const isCoach = prep.prompt_kind === "coach";
  const picker = prep.domain_picker?.enabled ? prep.domain_picker : null;
  const domainOptions = picker?.options?.length ? picker.options : [...DEFAULT_DOMAIN_OPTIONS];
  const allowOther = picker?.allow_other !== false;
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [domainOption, setDomainOption] = useState("");
  const [domainOther, setDomainOther] = useState("");
  const [domainStatus, setDomainStatus] = useState<string | null>(null);
  const savedJsonRef = useRef<Record<string, unknown>>({});
  const savedTextRef = useRef("");
  const lastMemoryRef = useRef<string>("");

  const featured = useMemo(() => {
    const ids = prep.featured_resource_ids?.length
      ? prep.featured_resource_ids
      : !hasPrompt && prep.template_resource_id
        ? [prep.template_resource_id]
        : [];
    const found: DayResource[] = [];
    for (const id of ids) {
      const row = resources.find((r) => r.id === id);
      if (row) found.push(row);
    }
    return found;
  }, [prep.featured_resource_ids, prep.template_resource_id, hasPrompt, resources]);

  const template = useMemo(() => {
    if (!prep.template_resource_id) return null;
    return resources.find((r) => r.id === prep.template_resource_id) || null;
  }, [prep.template_resource_id, resources]);

  const domainLabel = resolveDomainLabel(domainOption, domainOther);
  const savedDomainLabel = domainLabel || readCachedDomain(campId)?.label || "";

  const displayPrompt = useMemo(
    () => fillProfessionalDomain(prep.codex_prompt?.trim() || "", savedDomainLabel),
    [prep.codex_prompt, savedDomainLabel],
  );

  const persistMerged = useCallback(
    async (patch: Record<string, unknown>, targetCapsule = capsuleId) => {
      if (!campId) return;
      const targetDay = targetCapsule === PROFESSIONAL_DOMAIN_CAPSULE_ID ? PROFESSIONAL_DOMAIN_DAY : day.day;
      const res = await practiceApi.list({ camp_id: campId, day: targetDay });
      const row = res.items.find((it) => it.capsule_id === targetCapsule);
      const prev = (row?.response_json && typeof row.response_json === "object" ? row.response_json : {}) as Record<
        string,
        unknown
      >;
      const merged = { ...prev, ...patch };
      if (targetCapsule === capsuleId) {
        savedJsonRef.current = merged;
        if (row?.response_text) savedTextRef.current = row.response_text;
      }
      await practiceApi.save({
        camp_id: campId,
        day: targetDay,
        capsule_id: targetCapsule,
        response_text: row?.response_text || savedTextRef.current || "",
        response_json: merged,
        status: "draft",
      });
    },
    [campId, capsuleId, day.day],
  );

  const loadChecked = useCallback(async () => {
    if (!campId) return;
    try {
      const res = await practiceApi.list({ camp_id: campId, day: day.day });
      const row = res.items.find((it) => it.capsule_id === capsuleId);
      const saved = row?.response_json?.local_prep_checked;
      if (Array.isArray(saved)) {
        setChecked(new Set(saved.filter((n): n is number => typeof n === "number")));
      }
      if (row?.response_json && typeof row.response_json === "object") {
        savedJsonRef.current = row.response_json as Record<string, unknown>;
      }
      if (row?.response_text) savedTextRef.current = row.response_text;

      let mem = pickDomainFromPractices(res.items);
      if (!mem && day.day !== PROFESSIONAL_DOMAIN_DAY) {
        const day1 = await practiceApi.list({ camp_id: campId, day: PROFESSIONAL_DOMAIN_DAY });
        mem = pickDomainFromPractices(day1.items);
      }
      mem = mem || readCachedDomain(campId);
      if (mem) {
        setDomainOption(mem.option);
        setDomainOther(mem.other);
        writeCachedDomain(campId, mem);
        lastMemoryRef.current = mem.label;
      }
    } catch {
      const cached = readCachedDomain(campId);
      if (cached) {
        setDomainOption(cached.option);
        setDomainOther(cached.other);
      }
    }
  }, [campId, day.day, capsuleId]);

  useEffect(() => {
    void loadChecked();
  }, [loadChecked]);

  const persistChecked = async (next: Set<number>) => {
    if (!campId) return;
    setSaving(true);
    try {
      await persistMerged({ local_prep_checked: [...next] });
    } finally {
      setSaving(false);
    }
  };

  const rememberDomain = async (option: string, other: string) => {
    if (!campId || disabled || !picker) return;
    const label = resolveDomainLabel(option, other);
    if (!option) return;
    if (option === PROFESSIONAL_DOMAIN_OTHER && !other.trim()) {
      setDomainStatus("请填写具体的专业领域");
      return;
    }
    const mem: ProfessionalDomainMemory = { option, other: other.trim(), label };
    writeCachedDomain(campId, mem);
    lastMemoryRef.current = label;
    setDomainStatus("正在记住你的专业领域…");
    try {
      await persistMerged(memoryToPracticeJson(mem), PROFESSIONAL_DOMAIN_CAPSULE_ID);
      const payload = domainMemoryContent(mem);
      try {
        await kbApi.uploadMemory({
          title: payload.title,
          content: payload.content,
          camp_id: campId,
          tags: payload.tags,
        });
        setDomainStatus("已记住，第 4 节生成提示词时会用到");
      } catch (err) {
        const unavailable = err instanceof ApiError && (err.status === 503 || err.status === 502);
        setDomainStatus(
          unavailable ? "已记住，第 4 节生成提示词时会用到" : "已保存到学习记录，第 4 节会使用",
        );
      }
    } catch {
      setDomainStatus("保存失败，请稍后重试");
      toast.push("专业领域保存失败", "error");
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
    const text = displayPrompt;
    if (!text) {
      toast.push("暂无任务上下文", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.push(
        isCoach ? "学习教练提示词已复制（用于出题/审稿，勿当编码任务）" : "任务提示词已复制，请粘贴给对应 AI 员工",
        "success",
      );
    } catch {
      toast.push("复制失败，请手动选择文本复制", "error");
    }
  };

  return (
    <div className="local-prep-panel">
      {featured.length > 0 && (
        <section className="local-prep-featured" aria-label="课程资源">
          <h4>课程资源 · 请先完成</h4>
          <ul className="local-prep-featured-list">
            {featured.map((r) => (
              <li key={r.id} className="local-prep-featured-item">
                <div>
                  <strong>{r.title}</strong>
                  {r.summary && <p className="muted">{r.summary}</p>}
                </div>
                {r.url ? (
                  <a className="btn-primary" href={r.url} target="_blank" rel="noreferrer">
                    打开下载页
                  </a>
                ) : (
                  <span className="muted">{r.kind || "资料"}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {picker && (
        <section className="local-prep-card local-prep-domain" aria-label="专业领域">
          <h4>{picker.label || "我最熟悉的专业领域"}</h4>
          <p className="muted local-prep-domain-hint">
            请选择你真正熟悉的领域。平台会记住，第 4 节会按这个领域生成提示词。
          </p>
          <div className="local-prep-domain-row">
            <label className="local-prep-domain-field">
              <span>专业领域</span>
              <select
                value={domainOption}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value;
                  setDomainOption(next);
                  if (next !== PROFESSIONAL_DOMAIN_OTHER) setDomainOther("");
                  void rememberDomain(next, next === PROFESSIONAL_DOMAIN_OTHER ? domainOther : "");
                }}
              >
                <option value="">请选择</option>
                {domainOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                {allowOther && !domainOptions.includes(PROFESSIONAL_DOMAIN_OTHER) && (
                  <option value={PROFESSIONAL_DOMAIN_OTHER}>{PROFESSIONAL_DOMAIN_OTHER}</option>
                )}
              </select>
            </label>
            {allowOther && domainOption === PROFESSIONAL_DOMAIN_OTHER && (
              <label className="local-prep-domain-field">
                <span>具体领域</span>
                <input
                  type="text"
                  value={domainOther}
                  disabled={disabled}
                  placeholder="例如：保险精算、供应链、客服…"
                  onChange={(e) => setDomainOther(e.target.value)}
                  onBlur={() => void rememberDomain(domainOption, domainOther)}
                />
              </label>
            )}
          </div>
          {domainStatus && <p className="local-prep-domain-status">{domainStatus}</p>}
        </section>
      )}

      {!picker && savedDomainLabel && (
        <p className="local-prep-domain-banner">
          将使用你已选择的专业领域：<strong>{savedDomainLabel}</strong>
        </p>
      )}
      {!picker && !savedDomainLabel && prep.codex_prompt?.includes("{{professional_domain}}") && (
        <p className="local-prep-domain-banner">
          还没有专业领域记录。请先回第 1 节选择，复制后提示词会带上你的领域。
        </p>
      )}

      {hasPrompt && !prep.hide_copy && (
        <p className="local-prep-lead muted">
          {isCoach
            ? "本节是学习教练提示词：用来出题考你、审草稿、模拟评委。不要整段丢给编码 AI 当写代码任务。"
            : "平台提供任务边界和验收标准；请在开发工具中 @ 对应 AI 员工完成任务，最终批准或返工必须由你确认。"}
        </p>
      )}
      <div className={`local-prep-grid${hasPrompt ? "" : " local-prep-grid--single"}`}>
        <section className="local-prep-card">
          <h4>准备工作</h4>
          {checklist.length === 0 ? (
            <p className="muted">暂无准备事项。</p>
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
        {hasPrompt && (
          <section className={`local-prep-card${isCoach ? " local-prep-card--coach" : " local-prep-card--codex"}`}>
            <h4>
              {prep.prompt_title ||
                (isCoach ? "学习教练提示词（勿当编码任务）" : "复制给对应 AI 员工的任务提示词")}
            </h4>
            {prep.skill_id && !prep.hide_copy && <p className="local-prep-skill mono">Skill · {prep.skill_id}</p>}
            <pre className="local-prep-prompt">{displayPrompt}</pre>
            {(template?.url || !prep.hide_copy) && (
              <div className="local-prep-actions">
                {!prep.hide_copy && (
                  <button type="button" className="btn-primary" disabled={disabled} onClick={() => void copyPrompt()}>
                    {isCoach ? "复制学习教练提示词" : "复制任务提示词"}
                  </button>
                )}
                {template?.url && template.id !== featured[0]?.id && (
                  <a
                    className={prep.hide_copy ? "btn-primary" : "btn-ghost"}
                    href={template.url}
                    download={resourceDownloadName(template) || true}
                  >
                    {prep.template_label || "下载任务模板"}
                  </a>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
