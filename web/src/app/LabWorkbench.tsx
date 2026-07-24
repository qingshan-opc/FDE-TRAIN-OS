import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { agentApi, dayApi, evalApi, labApi, openEventSource, progressApi, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import type { DayPackage, EvalResult, NodeCompleteResult, NodeState, RubricCheck, WorkspaceFile } from "../lib/types";
import { ErrorState } from "../components/ErrorState";
import { ToolsPanel } from "../components/ToolsPanel";
import { Dialog } from "../components/Dialog";
import { ExplorerCrudDialog, type ExplorerCrudMode } from "../components/ide/ExplorerCrudDialog";
import { WorkspaceExplorer, type ExplorerAction } from "../components/ide/WorkspaceExplorer";
import { EditorTabs, type OpenTab } from "../components/ide/EditorTabs";
import { PreviewPane } from "../components/ide/PreviewPane";
import { BottomPanel, type BottomTab, type ProblemItem } from "../components/ide/BottomPanel";
import { IdeWorkbench, type MobilePane } from "../components/ide/IdeWorkbench";
import { SimTerminal } from "../components/ide/SimTerminal";
import { previewKindOf, isEditablePath } from "../lib/fileTypes";
import type { IdeDiagnostic } from "../components/ide/MonacoEditorPane";

const MonacoEditorPane = lazy(() =>
  import("../components/ide/MonacoEditorPane").then((m) => ({ default: m.MonacoEditorPane })),
);
const VersionDiffPane = lazy(() =>
  import("../components/ide/VersionDiffPane").then((m) => ({ default: m.VersionDiffPane })),
);

const ACTIVE = new Set(["queued", "hydrating", "running", "evaluating", "snapshotting"]);

type BufferState = {
  content: string;
  saved: string;
  dirty: boolean;
};

function sseKey(campId: string, nodeId: string) {
  return `fde.agent.sse:${campId}:${nodeId}`;
}

function layoutKey(campId: string) {
  return `fde.ide.layout:${campId}`;
}

export function LabWorkbench({
  day,
  node,
  onCompleted,
  locked,
}: {
  day: DayPackage;
  node: NodeState;
  onCompleted: (result?: NodeCompleteResult) => void;
  locked?: boolean;
}) {
  const { user, campId } = useAuth();
  const toast = useToast();
  const agent = (node.refs?.agent as { prompt_template?: string }) || day.lab?.agent || {};
  const rubric = (node.refs?.rubric || day.lab?.rubric || []) as RubricCheck[];

  const [prompt, setPrompt] = useState(agent.prompt_template || "");
  const [promptOpen, setPromptOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("code");
  const [bottomTab, setBottomTab] = useState<BottomTab>("events");

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [buffers, setBuffers] = useState<Record<string, BufferState>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"url" | "srcdoc">("srcdoc");
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceStub, setForceStub] = useState(false);
  const [snapshots, setSnapshots] = useState<
    { id: string; created_at?: string; file_count?: number; size_bytes?: number }[]
  >([]);
  const [headSnap, setHeadSnap] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [diagItems, setDiagItems] = useState<IdeDiagnostic[]>([]);
  const [revealLine, setRevealLine] = useState<number | null>(null);
  const [diffState, setDiffState] = useState<{ path: string; original: string; modified: string } | null>(null);
  const [crudDialog, setCrudDialog] = useState<{
    mode: ExplorerCrudMode;
    parentDir?: string;
    path?: string;
    initialValue: string;
  } | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef(0);

  const current = selectedFile ? buffers[selectedFile] : undefined;
  const fileContent = current?.content ?? "";
  const dirty = Boolean(current?.dirty);
  const anyDirty = useMemo(() => Object.values(buffers).some((b) => b.dirty), [buffers]);

  const persistCursor = (jid: string, after: number) => {
    if (!campId) return;
    try {
      sessionStorage.setItem(sseKey(campId, node.id), JSON.stringify({ jobId: jid, after }));
    } catch {
      /* ignore */
    }
  };

  const readCursor = (): { jobId: string; after: number } | null => {
    if (!campId) return null;
    try {
      const raw = sessionStorage.getItem(sseKey(campId, node.id));
      if (!raw) return null;
      return JSON.parse(raw) as { jobId: string; after: number };
    } catch {
      return null;
    }
  };

  const attachSSE = (jid: string, after = 0) => {
    esRef.current?.close();
    lastEventIdRef.current = after;
    setLogOpen(true);
    setBottomTab("events");
    esRef.current = openEventSource(
      agentApi.eventsUrl(jid),
      {
        onEvent: (data, id) => {
          if (id) {
            const n = Number(id);
            if (!Number.isNaN(n)) {
              lastEventIdRef.current = n;
              persistCursor(jid, n);
            }
          }
          const type = String(data.type || "event");
          const msg = data.message != null ? String(data.message) : JSON.stringify(data.payload || {});
          setLogs((prev) => [...prev.slice(-200), `[${type}] ${msg}`]);
          if (type === "terminal") {
            setStatus(String(data.status || "done"));
            void refreshFiles().catch(() => undefined);
            void loadSnapshots().catch(() => undefined);
            esRef.current?.close();
          } else if (data.status) {
            setStatus(String(data.status));
          }
        },
        onError: () => {
          setLogs((prev) => [...prev.slice(-200), "[sse] connection error / closed"]);
        },
      },
      { after },
    );
  };

  const applyPreview = async (path: string | null, content: string, _isDirty: boolean): Promise<void> => {
    if (!path || previewKindOf(path) !== "html") {
      if (path && previewKindOf(path) === "markdown") {
        setPreviewMode("srcdoc");
        setPreviewUrl(null);
        setPreviewHtml(null);
      }
      return;
    }
    if (!user || !campId) {
      setPreviewMode("srcdoc");
      setPreviewUrl(null);
      setPreviewHtml(content || null);
      return;
    }
    flushSync(() => {
      setPreviewMode("url");
      setPreviewUrl(agentApi.previewRenderUrl(campId, user.id, path));
      setPreviewHtml(null);
    });
  };

  const putBuffer = (path: string, content: string, saved = content) => {
    setBuffers((prev) => ({
      ...prev,
      [path]: { content, saved, dirty: content !== saved },
    }));
  };

  const ensureTab = (path: string) => {
    setOpenTabs((prev) => (prev.some((t) => t.path === path) ? prev : [...prev, { path, dirty: false }]));
  };

  const refreshFiles = async () => {
    if (!user || !campId) return;
    const res = await agentApi.listFiles(campId, user.id, { day: day.day });
    const list = res.files || [];
    setFiles(list);
    const declaredPrimary = new Set(day.lab?.primary_files || []);
    const primaryCandidates =
      (res.primary && res.primary.length ? res.primary : list.filter((f) => f.bucket === "primary")) ||
      (declaredPrimary.size ? list.filter((f) => declaredPrimary.has(f.path)) : []);
    const primary =
      (selectedFile && list.find((f) => f.path === selectedFile)) ||
      primaryCandidates[0] ||
      list.find((f) => f.path === "index.html") ||
      list.find((f) => f.path.toLowerCase().endsWith(".html")) ||
      list[0];
    if (primary) {
      await openFileInternal(primary.path, true);
    }
  };

  const loadSnapshots = async () => {
    if (!user || !campId) return;
    const res = await agentApi.listSnapshots(campId, user.id);
    setSnapshots(res.items || []);
    setHeadSnap(res.head?.snapshot_id || null);
  };

  const openFileInternal = async (path: string, force = false) => {
    if (!user || !campId) return;
    if (!force && selectedFile && buffers[selectedFile]?.dirty && selectedFile !== path) {
      setPendingSwitch(path);
      return;
    }
    setSelectedFile(path);
    ensureTab(path);
    setMobilePane("code");
    if (buffers[path] && !force) {
      applyPreview(path, buffers[path].content, buffers[path].dirty);
      return;
    }
    try {
      if (!isEditablePath(path)) {
        putBuffer(path, `（二进制文件 · ${path}）`, `（二进制文件 · ${path}）`);
        setPreviewMode("url");
        try {
          const res = await agentApi.previewUrl(campId, user.id, path);
          setPreviewUrl(res.url);
        } catch {
          setPreviewUrl(null);
        }
        return;
      }
      const res = await agentApi.readFile(campId, user.id, path);
      const text = res.content ?? "";
      putBuffer(path, text, text);
      applyPreview(path, text, false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "读取失败";
      putBuffer(path, msg, msg);
      setPreviewHtml(null);
    }
  };

  const openFile = (path: string) => void openFileInternal(path);

  useEffect(() => {
    setPrompt(agent.prompt_template || "");
    setEvalResult(null);
    setError(null);
    setLogs([]);
    setFiles([]);
    setOpenTabs([]);
    setSelectedFile(null);
    setBuffers({});
    setPreviewHtml(null);
    setPreviewUrl(null);
    setPreviewMode("srcdoc");
    setSnapshots([]);
    setPromptOpen(false);
    esRef.current?.close();
    lastEventIdRef.current = 0;

    let cancelled = false;
    (async () => {
      if (!user || !campId) {
        setJobId(null);
        setStatus("idle");
        return;
      }
      try {
        const active = await agentApi.listJobs(user.id, {
          active_only: true,
          camp_id: campId,
          node_id: node.id,
          limit: 5,
        });
        const job = active.items[0];
        const cursor = readCursor();
        if (!cancelled && job) {
          setJobId(job.id);
          setStatus(job.status);
          setLogs((prev) => [...prev, `[resume] 重挂活跃任务 ${job.id.slice(0, 8)}…`]);
          attachSSE(job.id, cursor?.jobId === job.id ? cursor.after || 0 : 0);
        } else if (!cancelled && cursor?.jobId) {
          const detail = await agentApi.getJob(cursor.jobId);
          const st = String(detail.status || "");
          setJobId(cursor.jobId);
          setStatus(st);
          if (ACTIVE.has(st)) {
            setLogs((prev) => [...prev, `[resume] 从事件 #${cursor.after} 继续`]);
            attachSSE(cursor.jobId, cursor.after || 0);
          } else {
            setLogs((prev) => [...prev, `[resume] 上次任务已结束 (${st})`]);
            await refreshFiles();
          }
        } else if (!cancelled) {
          setJobId(null);
          setStatus("idle");
        }
        if (!cancelled) {
          await refreshFiles().catch(() => undefined);
          await loadSnapshots().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setJobId(null);
          setStatus("idle");
        }
      }
    })();

    return () => {
      cancelled = true;
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.day, node.id, agent.prompt_template, user?.id, campId]);

  useEffect(() => {
    setOpenTabs((prev) =>
      prev.map((t) =>
        t.path === selectedFile
          ? { ...t, dirty, diagnostics: diagItems.filter((d) => d.path === selectedFile).length }
          : { ...t, dirty: Boolean(buffers[t.path]?.dirty) },
      ),
    );
  }, [dirty, diagItems, selectedFile, buffers]);

  const hasFileBuckets = useMemo(() => files.some((f) => f.bucket), [files]);

  const startJob = async () => {
    if (locked || !campId) return;
    setBusy(true);
    setError(null);
    setEvalResult(null);
    setLogs([]);
    setLogOpen(true);
    setBottomTab("events");
    try {
      await agentApi.ensure(campId);
      const job = await agentApi.createJob({
        prompt,
        node_id: node.id,
        force_stub: forceStub,
        camp_id: campId,
      });
      setJobId(job.job_id);
      setStatus(job.status);
      setLogs([`[job] ${job.job_id} runner=${job.runner}`]);
      persistCursor(job.job_id, 0);
      attachSSE(job.job_id, 0);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "启动失败";
      setError(msg);
      toast.push(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const saveFile = async (path = selectedFile) => {
    if (!user || !campId || !path || locked) return;
    const buf = buffers[path];
    if (!buf) return;
    setBusy(true);
    try {
      await agentApi.writeFile(campId, user.id, path, buf.content);
      putBuffer(path, buf.content, buf.content);
      toast.push("已保存", "success");
      await refreshFiles();
      await loadSnapshots();
      applyPreview(path, buf.content, false);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "保存失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const runLocal = async () => {
    if (selectedFile && previewKindOf(selectedFile) === "html") {
      setBusy(true);
      try {
        let html = fileContent;
        if (user && campId) {
          try {
            const res = await agentApi.readFile(campId, user.id, selectedFile);
            html = res.content ?? html;
          } catch {
            /* fall back to editor buffer */
          }
        }
        if (dirty && fileContent.trim()) html = fileContent;
        await applyPreview(selectedFile, html, dirty);
        setMobilePane("preview");
        toast.push("已刷新预览", "success");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (selectedFile && previewKindOf(selectedFile) === "markdown") {
      setMobilePane("preview");
      toast.push("已打开 Markdown 预览", "success");
      return;
    }
    const htmlPath = files.find((f) => f.path.toLowerCase().endsWith(".html"))?.path;
    if (htmlPath && user && campId) {
      void openFileInternal(htmlPath).then(() => {
        setMobilePane("preview");
        toast.push("已预览 " + htmlPath, "success");
      });
      return;
    }
    toast.push("暂无 HTML/Markdown 可预览，请先生成或打开文件", "error");
  };

  const runEval = async () => {
    if (!user || !campId) return;
    setBusy(true);
    setLogOpen(true);
    setBottomTab("eval");
    try {
      let res: EvalResult;
      if (dirty && selectedFile) {
        await agentApi.writeFile(campId, user.id, selectedFile, fileContent);
        putBuffer(selectedFile, fileContent, fileContent);
      }
      try {
        if (jobId) {
          const bridged = await evalApi.run({
            runner: "agent",
            job_id: jobId,
            rubric,
            camp_id: campId,
            day: day.day,
            node_id: node.id,
            write_evidence: true,
          });
          const inner = bridged.result || ({} as EvalResult);
          res = {
            pass: Boolean(inner.pass),
            checks: inner.checks || [],
            score: Number(inner.score ?? 0),
            weighted_score: inner.weighted_score,
          };
        } else {
          res = await agentApi.evaluateWorkspace(campId, user.id, rubric);
        }
      } catch {
        res = jobId
          ? await agentApi.evaluate(jobId, rubric)
          : await agentApi.evaluateWorkspace(campId, user.id, rubric);
      }
      setEvalResult(res);
      await refreshFiles();
      await loadSnapshots();
      toast.push(res.pass ? "评测通过" : "评测未通过", res.pass ? "success" : "error");
    } catch (err) {
      setError(err instanceof Error ? err.message : "评测失败");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!user || !campId) return;
    if (!evalResult?.pass) {
      toast.push("请先通过 Rubric 评测后再完成", "error");
      return;
    }
    setBusy(true);
    try {
      let result: NodeCompleteResult | undefined;
      try {
        result = await labApi.complete({
          camp_id: campId,
          day: day.day,
          node_id: node.id,
          job_id: jobId,
          eval_result: evalResult as unknown as Record<string, unknown>,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          const ev = await progressApi.writeEvidence({
            learner_id: user.id,
            day: day.day,
            node_id: node.id,
            kind: "agent",
            payload: { job_id: jobId, eval: evalResult },
            capability_tags: ["agent", `day:${day.day}`],
          });
          result = await dayApi.completeNode(node.id, {
            camp_id: campId,
            day: day.day,
            evidence_id: (ev as { id?: string }).id,
          });
        } else {
          throw err;
        }
      }
      toast.push("Lab 已完成", "success");
      onCompleted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成失败");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (snapshotId: string) => {
    if (!user || !campId || locked) return;
    setBusy(true);
    try {
      await agentApi.restoreSnapshot(campId, user.id, snapshotId);
      toast.push("已恢复到该版本", "success");
      setBuffers({});
      setDiffState(null);
      await refreshFiles();
      await loadSnapshots();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "恢复失败", "error");
    } finally {
      setBusy(false);
      setPendingRestore(null);
    }
  };

  const compareSnapshot = async (snapshotId: string) => {
    if (!user || !campId || !selectedFile) {
      toast.push("请先打开要比较的文本文件", "error");
      return;
    }
    if (!isEditablePath(selectedFile)) {
      toast.push("仅支持文本文件对比", "error");
      return;
    }
    setBusy(true);
    try {
      const snap = await agentApi.readSnapshotFile(campId, user.id, snapshotId, selectedFile);
      if (snap.status && snap.status !== "ok") {
        toast.push(`快照文件不可比：${snap.status}`, "error");
        return;
      }
      const modified = buffers[selectedFile]?.content ?? (await agentApi.readFile(campId, user.id, selectedFile)).content ?? "";
      setDiffState({ path: selectedFile, original: snap.content ?? "", modified });
      setVersionsOpen(true);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "对比失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleExplorerAction = (action: ExplorerAction) => {
    if (!user || !campId || locked) return;
    if (action.type === "new-file") {
      setCrudDialog({ mode: "new-file", parentDir: action.parentDir, initialValue: "untitled.txt" });
      return;
    }
    if (action.type === "new-dir") {
      setCrudDialog({ mode: "new-dir", parentDir: action.parentDir, initialValue: "src" });
      return;
    }
    if (action.type === "rename") {
      const base = action.path.split("/").pop() || action.path;
      setCrudDialog({ mode: "rename", path: action.path, initialValue: base });
      return;
    }
    if (action.type === "delete") {
      setCrudDialog({ mode: "delete", path: action.path, initialValue: "" });
    }
  };

  const executeCrudDialog = async (rawValue: string) => {
    if (!user || !campId || !crudDialog) return;
    const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);
    const { mode } = crudDialog;
    setBusy(true);
    try {
      if (mode === "new-file") {
        const path = join(crudDialog.parentDir || "", rawValue.replace(/^\/+/, ""));
        await agentApi.writeFile(campId, user.id, path, "");
        toast.push(`已创建 ${path}`, "success");
        setCrudDialog(null);
        await refreshFiles();
        await loadSnapshots();
        await openFileInternal(path, true);
        return;
      }
      if (mode === "new-dir") {
        const path = join(crudDialog.parentDir || "", rawValue.replace(/^\/+/, ""));
        await agentApi.mkdir(campId, user.id, path);
        toast.push(`已创建目录 ${path}`, "success");
        setCrudDialog(null);
        await refreshFiles();
        await loadSnapshots();
        return;
      }
      if (mode === "rename") {
        const actionPath = crudDialog.path!;
        const base = actionPath.split("/").pop() || actionPath;
        if (rawValue === base) {
          setCrudDialog(null);
          return;
        }
        if (buffers[actionPath]?.dirty) {
          toast.push("请先保存或丢弃未保存修改再重命名", "error");
          return;
        }
        const parent = actionPath.includes("/") ? actionPath.slice(0, actionPath.lastIndexOf("/")) : "";
        const to = join(parent, rawValue.replace(/^\/+/, ""));
        await agentApi.rename(campId, user.id, actionPath, to);
        setOpenTabs((prev) => prev.map((t) => (t.path === actionPath ? { ...t, path: to } : t)));
        setBuffers((prev) => {
          if (!prev[actionPath]) return prev;
          const next = { ...prev };
          next[to] = next[actionPath];
          delete next[actionPath];
          return next;
        });
        if (selectedFile === actionPath) setSelectedFile(to);
        toast.push(`已重命名为 ${to}`, "success");
        setCrudDialog(null);
        await refreshFiles();
        await loadSnapshots();
        return;
      }
      if (mode === "delete") {
        const actionPath = crudDialog.path!;
        if (buffers[actionPath]?.dirty) {
          toast.push("请先保存或丢弃未保存修改再删除", "error");
          return;
        }
        await agentApi.deleteFile(campId, user.id, actionPath);
        setOpenTabs((prev) => prev.filter((t) => t.path !== actionPath && !t.path.startsWith(actionPath + "/")));
        setBuffers((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (k === actionPath || k.startsWith(actionPath + "/")) delete next[k];
          }
          return next;
        });
        if (selectedFile === actionPath || selectedFile?.startsWith(actionPath + "/")) {
          setSelectedFile(null);
          setPreviewHtml(null);
          setPreviewUrl(null);
        }
        toast.push(`已删除 ${actionPath}`, "success");
        setCrudDialog(null);
        await refreshFiles();
        await loadSnapshots();
      }
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "文件操作失败", "error");
      await refreshFiles().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  const closeTab = (path: string) => {
    if (buffers[path]?.dirty) {
      setPendingSwitch(`__close__:${path}`);
      return;
    }
    setOpenTabs((prev) => prev.filter((t) => t.path !== path));
    if (selectedFile === path) {
      const rest = openTabs.filter((t) => t.path !== path);
      const next = rest[rest.length - 1]?.path || null;
      setSelectedFile(next);
      if (next) applyPreview(next, buffers[next]?.content || "", Boolean(buffers[next]?.dirty));
      else {
        setPreviewHtml(null);
        setPreviewUrl(null);
      }
    }
  };

  const resolvePending = async (action: "save" | "discard" | "cancel") => {
    const target = pendingSwitch;
    setPendingSwitch(null);
    if (!target || action === "cancel") return;
    const isClose = target.startsWith("__close__:");
    const path = isClose ? target.slice("__close__:".length) : target;
    const from = selectedFile;
    if (action === "save" && from) await saveFile(from);
    if (action === "discard" && from) {
      const saved = buffers[from]?.saved ?? "";
      putBuffer(from, saved, saved);
    }
    if (isClose) {
      setOpenTabs((prev) => prev.filter((t) => t.path !== path));
      if (selectedFile === path) {
        const rest = openTabs.filter((t) => t.path !== path);
        setSelectedFile(rest[rest.length - 1]?.path || null);
      }
    } else {
      await openFileInternal(path, true);
    }
  };

  const problems: ProblemItem[] = diagItems.map((d) => ({
    path: d.path,
    message: d.message,
    severity: d.severity,
    line: d.line,
  }));

  const defaultLayout = (() => {
    try {
      if (!campId) return undefined;
      const raw = localStorage.getItem(layoutKey(campId));
      return raw ? (JSON.parse(raw) as { files?: number; editor?: number; preview?: number }) : undefined;
    } catch {
      return undefined;
    }
  })();

  return (
    <IdeWorkbench
      toolbar={
        <div className="lab-ide-toolbar">
          <div className="lab-ide-title">
            <strong>{node.title}</strong>
            <span className="muted mono">
              {status}
              {jobId ? ` · ${jobId.slice(0, 8)}` : ""}
              {anyDirty ? " · 未保存" : ""}
              {headSnap ? ` · snap ${headSnap.slice(0, 8)}` : ""}
            </span>
          </div>
          <div className="lab-ide-actions">
            <button type="button" className="btn-primary" disabled={locked || busy || !prompt.trim()} onClick={() => void startJob()}>
              生成
            </button>
            <button type="button" disabled={locked || busy || !selectedFile} onClick={() => void saveFile()} title="⌘/Ctrl+S">
              保存
            </button>
            <button type="button" disabled={busy} onClick={() => void runLocal()}>
              运行
            </button>
            <button type="button" disabled={locked || busy} onClick={() => void runEval()}>
              评测
            </button>
            <button type="button" disabled={locked || busy || node.status === "passed" || !evalResult?.pass} onClick={() => void finish()}>
              完成
            </button>
          </div>
        </div>
      }
      banners={
        <>
          {evalResult?.pass && node.status !== "passed" && (
            <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
              评测已通过：点「完成」结束本节点后，前往「企业任务」节点提交本日作业。
            </p>
          )}
          {error && <ErrorState title="Agent 错误" message={error} onRetry={() => void startJob()} />}
          {locked && (
            <div className="panel" style={{ borderColor: "var(--color-warn)", marginBottom: 8 }}>
              <p className="muted">节点未解锁：可浏览，生成/保存/评测已禁用。请先完成学习与测验。</p>
            </div>
          )}
          {diffState && (
            <Suspense fallback={null}>
              <VersionDiffPane
                path={diffState.path}
                original={diffState.original}
                modified={diffState.modified}
                onClose={() => setDiffState(null)}
              />
            </Suspense>
          )}
        </>
      }
      meta={
        <>
          <div className="lab-ide-meta">
            <button type="button" className="lab-ide-fold" onClick={() => setPromptOpen((v) => !v)}>
              任务说明 {promptOpen ? "▾" : "▸"}
            </button>
            <button type="button" className="lab-ide-fold" onClick={() => setAdvancedOpen((v) => !v)}>
              高级 {advancedOpen ? "▾" : "▸"}
            </button>
            <button type="button" className="lab-ide-fold" onClick={() => setVersionsOpen((v) => !v)}>
              版本 {versionsOpen ? "▾" : "▸"}
            </button>
            <button type="button" className="lab-ide-fold" onClick={() => setToolsOpen((v) => !v)}>
              工具与资料 {toolsOpen ? "▾" : "▸"}
            </button>
          </div>
          {promptOpen && (
            <div className="lab-ide-prompt field">
              <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={locked || busy} rows={4} />
            </div>
          )}
          {advancedOpen && (
            <label className="row lab-ide-advanced" htmlFor="force-stub">
              <input
                id="force-stub"
                type="checkbox"
                checked={forceStub}
                onChange={(e) => setForceStub(e.target.checked)}
                disabled={locked}
              />
              <span className="muted">演示模板 force_stub（无 anyCode 时）</span>
            </label>
          )}
          {toolsOpen && <ToolsPanel day={day} />}
          {versionsOpen && (
            <div className="lab-ide-versions">
              {snapshots.length === 0 ? (
                <p className="muted">暂无版本</p>
              ) : (
                <ul>
                  {snapshots.slice(0, 8).map((s) => (
                    <li key={s.id}>
                      <span className="mono">{s.id.slice(0, 8)}</span>
                      {headSnap === s.id && <span className="muted"> · 当前</span>}
                      <span className="muted">
                        {" "}
                        · {s.file_count ?? "?"} 文件 · {s.size_bytes != null ? `${Math.round(s.size_bytes / 1024)}KB` : "?"}
                        {s.created_at ? ` · ${String(s.created_at).slice(0, 19)}` : ""}
                      </span>
                      <button
                        type="button"
                        disabled={locked || busy || !selectedFile}
                        onClick={() => void compareSnapshot(s.id)}
                      >
                        与当前比较
                      </button>
                      <button
                        type="button"
                        disabled={locked || busy || headSnap === s.id}
                        onClick={() => setPendingRestore(s.id)}
                      >
                        恢复
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      }
      mobilePane={mobilePane}
      onMobilePane={(id) => {
        setMobilePane(id);
        if (id === "log") setLogOpen(true);
      }}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout) => {
        if (!campId) return;
        try {
          localStorage.setItem(layoutKey(campId), JSON.stringify(layout));
        } catch {
          /* ignore */
        }
      }}
      explorer={
        <WorkspaceExplorer
          files={files}
          selectedPath={selectedFile}
          onSelect={openFile}
          hasBuckets={hasFileBuckets}
          locked={locked}
          onAction={(a) => void handleExplorerAction(a)}
        />
      }
      editor={
        <div className="lab-ide-editor ide-editor-stack">
          <EditorTabs tabs={openTabs} activePath={selectedFile} onSelect={openFile} onClose={closeTab} />
          <Suspense fallback={<div className="muted" style={{ padding: 16 }}>加载 Monaco…</div>}>
            <MonacoEditorPane
              path={selectedFile}
              value={fileContent}
              editable={!locked && !!selectedFile && isEditablePath(selectedFile || "")}
              onChange={(v) => {
                if (!selectedFile) return;
                setBuffers((prev) => {
                  const saved = prev[selectedFile]?.saved ?? "";
                  return { ...prev, [selectedFile]: { content: v, saved, dirty: v !== saved } };
                });
              }}
              onSave={() => void saveFile()}
              onDiagnostics={(_n, items) => setDiagItems(items)}
              revealLine={revealLine}
            />
          </Suspense>
        </div>
      }
      preview={
        <PreviewPane
          path={selectedFile}
          content={fileContent}
          previewMode={previewMode}
          previewUrl={previewUrl}
          previewHtml={previewHtml}
        />
      }
      bottom={
        <BottomPanel
          open={logOpen}
          onToggle={() => setLogOpen((v) => !v)}
          tab={bottomTab}
          onTab={setBottomTab}
          logs={logs}
          evalResult={evalResult}
          problems={problems}
          onProblemClick={(p) => {
            void openFileInternal(p.path).then(() => {
              setRevealLine(p.line ?? null);
              setBottomTab("problems");
              setMobilePane("code");
            });
          }}
          terminal={
            <SimTerminal
              lines={logs}
              readOnly
              title="Agent 事件输出（只读）"
              disabled={busy}
            />
          }
        />
      }
      dialogs={
        <>
          <ExplorerCrudDialog
            open={Boolean(crudDialog)}
            mode={crudDialog?.mode ?? null}
            initialValue={crudDialog?.initialValue ?? ""}
            targetPath={crudDialog?.path}
            busy={busy}
            onClose={() => setCrudDialog(null)}
            onConfirm={(v) => void executeCrudDialog(v)}
          />
          <Dialog
            open={Boolean(pendingSwitch)}
            title="未保存的修改"
            onClose={() => setPendingSwitch(null)}
            footer={
              <>
                <button type="button" onClick={() => void resolvePending("cancel")}>
                  取消
                </button>
                <button type="button" onClick={() => void resolvePending("discard")}>
                  丢弃
                </button>
                <button type="button" className="btn-primary" onClick={() => void resolvePending("save")}>
                  保存
                </button>
              </>
            }
          >
            <p>当前文件有未保存修改，请选择保存、丢弃或取消。</p>
          </Dialog>
          <Dialog
            open={Boolean(pendingRestore)}
            title="恢复工作区版本"
            onClose={() => setPendingRestore(null)}
            footer={
              <>
                <button type="button" onClick={() => setPendingRestore(null)}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => pendingRestore && void restore(pendingRestore)}
                >
                  确认恢复
                </button>
              </>
            }
          >
            <p>
              将工作区头指针恢复到快照 <span className="mono">{pendingRestore?.slice(0, 8)}</span>
              。未保存的本地编辑会丢失，是否继续？
            </p>
          </Dialog>
        </>
      }
    />
  );
}
