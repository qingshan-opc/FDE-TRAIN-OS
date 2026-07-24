import { useState } from "react";
import { kbApi, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

/** Upload notes into Lingzhi Memories — used from Profile and Lab coach drawer. */
export function MemoriesUploader({ dayLabel, compact }: { dayLabel?: string; compact?: boolean }) {
  const { campId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [memTitle, setMemTitle] = useState("");
  const [memContent, setMemContent] = useState("");
  const [memMsg, setMemMsg] = useState<string | null>(null);

  const uploadMemory = async () => {
    if (!memContent.trim() || busy) return;
    setBusy(true);
    setMemMsg(null);
    try {
      const res = await kbApi.uploadMemory({
        title: memTitle.trim() || `${dayLabel || "学习"}笔记`,
        content: memContent.trim(),
        camp_id: campId || undefined,
        tags: dayLabel ? [`day:${dayLabel}`] : [],
      });
      setMemMsg(res.mode === "live" ? "已写入灵知 Memories" : "已提交");
      setMemContent("");
    } catch (err) {
      setMemMsg(err instanceof ApiError ? err.message : "上传失败（需配置营期灵知 Key）");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`panel memories-uploader${compact ? " memories-uploader--compact" : ""}`} aria-label="Memories">
      <h3 style={{ marginBottom: compact ? 6 : 8, fontSize: compact ? 15 : undefined }}>上传 Memories</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: compact ? 6 : 8 }}>
        写入灵知个人记忆（需教研配置营期 Key）
      </p>
      {!compact && (
        <div className="field">
          <label htmlFor="mem-title">标题</label>
          <input id="mem-title" value={memTitle} onChange={(e) => setMemTitle(e.target.value)} disabled={busy} />
        </div>
      )}
      <div className="field">
        {!compact && <label htmlFor="mem-body">内容</label>}
        <textarea
          id="mem-body"
          rows={compact ? 2 : 3}
          value={memContent}
          onChange={(e) => setMemContent(e.target.value)}
          disabled={busy}
          placeholder={compact ? "学习笔记、避坑要点…" : "例如：客服 FAQ 要点、今日避坑…"}
        />
      </div>
      <button type="button" className="app-btn app-btn--primary" style={{ width: "100%" }} disabled={busy || !memContent.trim()} onClick={() => void uploadMemory()}>
        {busy ? "上传中…" : "上传记忆"}
      </button>
      {memMsg && (
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          {memMsg}
        </p>
      )}
    </div>
  );
}
