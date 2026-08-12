import { toQuery, type ListQuery, type Paginated } from "./listQuery";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Fired once when the server indicates this device was replaced by a newer login. */
let sessionReplacedNotified = false;
type SessionReplacedHandler = () => void;
let onSessionReplaced: SessionReplacedHandler | null = null;

export function setSessionReplacedHandler(handler: SessionReplacedHandler | null) {
  onSessionReplaced = handler;
  sessionReplacedNotified = false;
}

export function isSessionReplacedError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 401) return false;
  const msg = err.message || "";
  return msg === "session_replaced" || msg.includes("其他设备") || msg.includes("登录已失效");
}

function maybeNotifySessionReplaced(err: ApiError) {
  if (!isSessionReplacedError(err) || sessionReplacedNotified) return;
  sessionReplacedNotified = true;
  try {
    onSessionReplaced?.();
  } catch {
    /* ignore UI handler errors */
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail) && "message" in detail) {
    const msg = (detail as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : String(d))).join("; ");
  }
  if ("message" in (body as object) && typeof (body as { message: unknown }).message === "string") {
    return (body as { message: string }).message;
  }
  return fallback;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const csrf = getCookie("fde_csrf");
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: "{}",
      });
      if (!res.ok) {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(await res.text());
        } catch {
          parsed = null;
        }
        const msg = messageFromBody(parsed, "");
        if (msg === "session_replaced") {
          maybeNotifySessionReplaced(new ApiError(res.status, msg, parsed));
        }
      }
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipRefresh?: boolean;
  formData?: FormData;
};

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, skipRefresh, formData, headers: extraHeaders, ...rest } = options;
  const csrf = getCookie("fde_csrf");
  const headers = new Headers(extraHeaders);

  if (!formData && body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (csrf && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(path, {
    ...rest,
    credentials: "include",
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401 && !skipRefresh && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    // Peek body first — if already session_replaced, skip refresh (refresh cookie is dead too)
    const peekText = await res.clone().text();
    let peekParsed: unknown = null;
    if (peekText) {
      try {
        peekParsed = JSON.parse(peekText);
      } catch {
        peekParsed = peekText;
      }
    }
    const peekMsg = messageFromBody(peekParsed, "");
    if (peekMsg !== "session_replaced") {
      const ok = await tryRefresh();
      if (ok) return api<T>(path, { ...options, skipRefresh: true });
    }
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const err = new ApiError(res.status, messageFromBody(parsed, res.statusText || `HTTP ${res.status}`), parsed);
    if (err.status === 401) maybeNotifySessionReplaced(err);
    throw err;
  }

  return parsed as T;
}

export function openEventSource(
  path: string,
  handlers: {
    onEvent: (data: Record<string, unknown>, id?: string) => void;
    onError?: (err: Event) => void;
  },
  opts?: { after?: number | string },
): EventSource {
  let url = path;
  if (opts?.after != null && opts.after !== "" && opts.after !== 0) {
    const sep = path.includes("?") ? "&" : "?";
    url = `${path}${sep}after=${encodeURIComponent(String(opts.after))}`;
  }
  const es = new EventSource(url, { withCredentials: true } as EventSourceInit);
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as Record<string, unknown>;
      handlers.onEvent(data, ev.lastEventId);
    } catch {
      handlers.onEvent({ type: "raw", message: ev.data }, ev.lastEventId);
    }
  };
  es.onerror = (err) => {
    handlers.onError?.(err);
  };
  return es;
}

/** Auth */
type AuthSession = {
  token: string;
  csrf: string;
  user: import("./types").User;
  camp_id: string | null;
  camps: import("./types").Camp[];
  wx_bound?: boolean;
  needs_wx_bind?: boolean;
  profile_incomplete?: boolean;
  default_home?: string;
  portals?: import("./types").AuthPortal[];
};

export const authApi = {
  login: (email: string, password: string, camp_id?: string, remember?: boolean) =>
    api<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password, camp_id: camp_id || undefined, remember: Boolean(remember) },
      skipRefresh: true,
    }),
  wechatLoginQr: () =>
    api<{ state: string; qr_content: string; qr_url: string; expire_seconds: number }>(
      "/api/v1/auth/wechat/login-qr",
      { method: "POST", skipRefresh: true },
    ),
  wechatLoginStatus: (state: string, opts?: { expect_role?: string }) => {
    const q = new URLSearchParams({ state });
    if (opts?.expect_role) q.set("expect_role", opts.expect_role);
    return api<{
      pending: boolean;
      done: boolean;
      expired: boolean;
      redirect?: string;
      user?: import("./types").User;
      org_id?: string | null;
      error?: string;
    }>(`/api/v1/auth/wechat/login-status?${q.toString()}`, { skipRefresh: true });
  },
  wechatBindStart: () =>
    api<{
      already_bound?: boolean;
      wx_bound?: boolean;
      ticket?: string;
      state?: string;
      qr_content?: string;
      qr_url?: string;
      expire_seconds?: number;
    }>("/api/v1/auth/wechat/bind-start", { method: "POST" }),
  wechatBindStatus: (ticket: string) =>
    api<{ pending: boolean; done: boolean; expired: boolean; wx_bound?: boolean }>(
      `/api/v1/auth/wechat/bind-status?ticket=${encodeURIComponent(ticket)}`,
    ),
  passwordResetStart: (email: string) =>
    api<{
      ticket: string;
      state: string;
      qr_content: string;
      qr_url: string;
      expire_seconds: number;
      hint?: string;
    }>("/api/v1/auth/password-reset/start", {
      method: "POST",
      body: { email },
      skipRefresh: true,
    }),
  passwordResetStatus: (ticket: string) =>
    api<{ pending: boolean; code_sent: boolean; expired: boolean; used?: boolean }>(
      `/api/v1/auth/password-reset/status?ticket=${encodeURIComponent(ticket)}`,
      { skipRefresh: true },
    ),
  passwordResetConfirm: (email: string, code: string, new_password: string) =>
    api<{ ok: boolean }>("/api/v1/auth/password-reset/confirm", {
      method: "POST",
      body: { email, code, new_password },
      skipRefresh: true,
    }),
  me: () => api<import("./types").AuthMe>("/api/v1/auth/me", { skipRefresh: true }),

  logout: () => api<{ status: string }>("/api/v1/auth/logout", { method: "POST" }),
  invite: (invite_code: string, display_name: string, email?: string) =>
    api<AuthSession>("/api/v1/auth/invite", {
      method: "POST",
      body: { invite_code, display_name, email: email || undefined },
      skipRefresh: true,
    }),
  register: (email: string, password: string, display_name: string) =>
    api<AuthSession>("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, display_name },
      skipRefresh: true,
    }),
  /** Open org registration link — sets httpOnly cookie used on register. */
  claimInviteLink: (code: string) =>
    api<{
      valid: boolean;
      code: string;
      kind?: "org" | "learner";
      org_name?: string;
      referrer_name?: string;
    }>(`/api/v1/auth/invite-link?code=${encodeURIComponent(code)}`, { skipRefresh: true }),
  switchCamp: (camp_id: string) =>
    api<{ token: string; csrf: string; user: import("./types").User; camp_id: string | null; camps: import("./types").Camp[] }>(
      "/api/v1/auth/switch-camp",
      { method: "POST", body: { camp_id } },
    ),
  switchEnrollment: (enrollment_id: string) =>
    api<{
      token: string;
      csrf: string;
      user: import("./types").User;
      camp_id: string | null;
      camps: import("./types").Camp[];
      active_enrollment_id: string;
      enrollment: Record<string, unknown>;
    }>("/api/v1/auth/switch-enrollment", { method: "POST", body: { enrollment_id } }),
};

/** Orchestrator */
export const dayApi = {
  list: (campId: string) =>
    api<{ camp_id: string; days: import("./types").DaySummary[]; count: number; weeks: Record<string, number[]> }>(
      `/api/v1/camps/${encodeURIComponent(campId)}/days`,
    ),
  get: (campId: string, day: number) =>
    api<import("./types").DayPackage>(`/api/v1/camps/${encodeURIComponent(campId)}/days/${day}`),
  completeNode: (nodeId: string, body: { camp_id: string; day: number; evidence_id?: string }) =>
    api<import("./types").NodeCompleteResult>(`/api/v1/nodes/${encodeURIComponent(nodeId)}/complete`, {
      method: "POST",
      body,
    }),
  submitQuiz: (body: { camp_id: string; day: number; node_id: string; answers: number[] }) =>
    api<{
      attempt_id: string;
      score: number;
      pass: boolean;
      pass_rate: number;
      correct: number;
      total: number;
      details: { index: number; correct: boolean; answer: number; explain: string }[];
    }>("/api/v1/quiz/submit", { method: "POST", body }),
  /** Learner-facing supplementary materials (author-uploaded, DB-backed) — a
   * day may have none yet (`placeholder: true`); the package's own
   * `resources` (YAML, e.g. tool guides) ships on `DayPackage.resources`. */
  resources: (campId: string, day: number) =>
    api<{ camp_id: string; day: number; items: Record<string, unknown>[]; placeholder: boolean }>(
      `/api/v1/camps/${encodeURIComponent(campId)}/days/${day}/resources`,
    ),
};

/** Capsule progress — planned path; falls back to evidence */
export const capsuleApi = {
  list: (params: { camp_id: string; day?: number }) => {
    const q = new URLSearchParams();
    q.set("camp_id", params.camp_id);
    if (params.day != null) q.set("day", String(params.day));
    return api<{ items: { day: number; capsule_id: string; opened_at: string }[]; learner_id: string; camp_id: string }>(
      `/api/v1/capsules/progress?${q.toString()}`,
    );
  },
  markOpened: async (body: { camp_id: string; day: number; capsule_id: string; learner_id: string }) => {
    try {
      return await api("/api/v1/capsules/progress", { method: "POST", body });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
        return api("/api/v1/evidence", {
          method: "POST",
          body: {
            learner_id: body.learner_id,
            camp_version: "v0.3",
            day: body.day,
            node_id: `d${body.day}-learn`,
            kind: "capsule",
            payload: { capsule_id: body.capsule_id },
            capability_tags: [`capsule:${body.capsule_id}`],
          },
        });
      }
      throw err;
    }
  },
};

/** Per-capsule practice responses (M7) — draft autosave + explicit submit. */
export const practiceApi = {
  list: (params: { camp_id: string; day?: number }) => {
    const q = new URLSearchParams();
    q.set("camp_id", params.camp_id);
    if (params.day != null) q.set("day", String(params.day));
    return api<{ items: import("./types").PracticeResponse[]; learner_id: string; camp_id: string }>(
      `/api/v1/practice?${q.toString()}`,
    );
  },
  save: (body: {
    camp_id: string;
    day: number;
    capsule_id: string;
    response_text: string;
    response_json?: Record<string, unknown>;
    status?: "draft" | "submitted";
    force_reopen?: boolean;
  }) =>
    api<import("./types").PracticeResponse & { id: string; learner_id: string }>("/api/v1/practice", {
      method: "PUT",
      body,
    }),
};

/** AI 导师 */
export interface CoachAskBody {
  question: string;
  camp_id?: string;
  day?: number;
  node_id?: string;
  learner_id?: string;
  help_mode?: "explain" | "debug" | "process" | "interview" | "review";
  fail_count?: number;
  fallback_steps?: string[];
  agent_job_id?: string;
  sim_summary?: string;
  skill_id?: string;
  max_help_level?: number;
}

export const coachApi = {
  ask: (body: CoachAskBody) =>
    api<{
      reply: string;
      level: number;
      coach_mode: string;
      citations: { id?: string; title?: string; snippet?: string }[];
      kb_mode?: string;
      diagnostics?: import("./types").CoachDiagnostics;
    }>("/api/v1/coach/ask", { method: "POST", body }),

  /** SSE: meta → delta* → done */
  askStream: async (
    body: CoachAskBody,
    handlers: {
      onMeta?: (meta: { level?: number; kb_mode?: string; citations?: { title?: string; id?: string }[] }) => void;
      onDelta?: (text: string) => void;
      onDone?: (done: {
        reply: string;
        level: number;
        coach_mode: string;
        kb_mode?: string;
        citations?: { id?: string; title?: string; snippet?: string }[];
        diagnostics?: import("./types").CoachDiagnostics;
      }) => void;
    },
  ) => {
    const csrf = getCookie("fde_csrf");
    const res = await fetch("/api/v1/coach/ask/stream", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let parsed: unknown = null;
      try {
        parsed = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, messageFromBody(parsed, `HTTP ${res.status}`), parsed);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new ApiError(500, "无响应流");
    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "message";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";
      for (const line of parts) {
        const trimmed = line.replace(/\r$/, "");
        if (!trimmed) {
          eventName = "message";
          continue;
        }
        if (trimmed.startsWith("event:")) {
          eventName = trimmed.slice(6).trim() || "message";
          continue;
        }
        if (trimmed.startsWith("data:")) {
          const raw = trimmed.slice(5).trim();
          try {
            const data = JSON.parse(raw) as Record<string, unknown>;
            if (eventName === "meta") handlers.onMeta?.(data as never);
            else if (eventName === "delta" && typeof data.text === "string") handlers.onDelta?.(data.text);
            else if (eventName === "done") handlers.onDone?.(data as never);
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    }
  },

  /** 基于最新失败测验/评测的确定性诊断（无需 LLM，anyCode/灵知不可用时仍可用）。 */
  diagnose: (body: { camp_id?: string; day?: number; node_id?: string }) =>
    api<import("./types").CoachDiagnostics & { mode: "offline" }>("/api/v1/coach/diagnose", {
      method: "POST",
      body,
    }),

  /** 申请导师复核 — 创建待处理的 mentor_reviews 记录。 */
  handoff: (body: { camp_id?: string; day?: number; node_id?: string; question?: string; coach_turn_id?: string }) =>
    api<{ ok: boolean; review_id: string; status: string; diagnostics: import("./types").CoachDiagnostics }>(
      "/api/v1/coach/handoff",
      { method: "POST", body },
    ),

  /** 学员查看当前课次/节点的导师复核结果。 */
  listMentorReviews: (params: { camp_id?: string; day: number; node_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    q.set("day", String(params.day));
    if (params.camp_id) q.set("camp_id", params.camp_id);
    if (params.node_id) q.set("node_id", params.node_id);
    if (params.limit != null) q.set("limit", String(params.limit));
    return api<{ items: import("./types").MentorReview[] }>(`/api/v1/coach/mentor-reviews?${q.toString()}`);
  },
};

/** EvalBridge */
export const evalApi = {
  run: (body: {
    runner: "agent" | "sim";
    rubric: import("./types").RubricCheck[];
    job_id?: string;
    sim_session_id?: string;
    camp_id?: string;
    day?: number;
    node_id?: string;
    write_evidence?: boolean;
  }) =>
    api<{
      result?: import("./types").EvalResult;
      evidence_id?: string;
      learner_id?: string;
    }>("/api/v1/eval/run", { method: "POST", body }),
};

/** Atomic lab completion (M3) — one call for submission + evidence + progress. */
export const labApi = {
  complete: (body: {
    camp_id: string;
    day: number;
    node_id: string;
    job_id?: string | null;
    eval_result: Record<string, unknown>;
    snapshot_id?: string | null;
  }) => api<import("./types").LabCompleteResult>("/api/v1/labs/complete", { method: "POST", body }),
};

/** Course media playback */
export const mediaApi = {
  presign: (object_key: string, camp_id?: string) =>
    api<{ url: string; expires_in: number; object_key: string; bucket: string }>(
      `/api/v1/media/presign?object_key=${encodeURIComponent(object_key)}${
        camp_id ? `&camp_id=${encodeURIComponent(camp_id)}` : ""
      }`,
    ),
};

/** Agent */
export const agentApi = {
  ensure: (camp_id?: string) =>
    api<{ workspace: string; size_bytes: number; camp_id: string; learner_id: string }>(
      "/api/v1/agent/workspaces/ensure",
      { method: "POST", body: { camp_id } },
    ),
  createJob: (body: { prompt: string; node_id?: string; force_stub?: boolean; camp_id?: string }) =>
    api<{ job_id: string; legacy_job_id?: string; runner: string; status: string }>("/api/v1/agent/jobs", {
      method: "POST",
      body,
    }),
  getJob: (jobId: string) => api<Record<string, unknown>>(`/api/v1/agent/jobs/${encodeURIComponent(jobId)}`),
  evaluate: (jobId: string, rubric: import("./types").RubricCheck[]) =>
    api<import("./types").EvalResult>(`/api/v1/agent/jobs/${encodeURIComponent(jobId)}/evaluate`, {
      method: "POST",
      body: { rubric },
    }),
  cancel: (jobId: string) =>
    api<{ status: string }>(`/api/v1/agent/jobs/${encodeURIComponent(jobId)}/cancel`, { method: "POST" }),
  listFiles: (campId: string, learnerId: string, opts?: { day?: number; view?: "primary" | "all" | "history" }) => {
    const q = new URLSearchParams();
    if (opts?.day != null) q.set("day", String(opts.day));
    if (opts?.view) q.set("view", opts.view);
    const qs = q.toString();
    return api<{
      files: import("./types").WorkspaceFile[];
      size_bytes: number;
      primary?: import("./types").WorkspaceFile[];
      inherited?: import("./types").WorkspaceFile[];
    }>(`/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/files${qs ? `?${qs}` : ""}`);
  },
  readFile: (campId: string, learnerId: string, path: string) =>
    api<import("./types").WorkspaceEntry>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/file?path=${encodeURIComponent(path)}`,
    ),
  writeFile: (campId: string, learnerId: string, path: string, content: string) =>
    api<{ ok: boolean; path: string; snapshot_id: string; size_bytes: number }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/files`,
      { method: "PUT", body: { path, content } },
    ),
  mkdir: (campId: string, learnerId: string, path: string) =>
    api<{ ok: boolean; path: string; snapshot_id: string }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/mkdir`,
      { method: "POST", body: { path } },
    ),
  rename: (campId: string, learnerId: string, from_path: string, to_path: string) =>
    api<{ ok: boolean; from_path: string; to_path: string; snapshot_id: string }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/rename`,
      { method: "POST", body: { from_path, to_path } },
    ),
  deleteFile: (campId: string, learnerId: string, path: string) =>
    api<{ ok: boolean; path: string; snapshot_id: string }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/files?path=${encodeURIComponent(path)}`,
      { method: "DELETE" },
    ),
  evaluateWorkspace: (campId: string, learnerId: string, rubric: import("./types").RubricCheck[]) =>
    api<import("./types").EvalResult>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/evaluate`,
      { method: "POST", body: { rubric } },
    ),
  previewUrl: (campId: string, learnerId: string, path = "index.html") =>
    api<{ url: string; expires_in: number; path: string }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/preview-url?path=${encodeURIComponent(path)}`,
    ),
  previewRenderUrl: (campId: string, learnerId: string, path = "index.html") =>
    `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/preview-render?path=${encodeURIComponent(path)}`,
  listSnapshots: (campId: string, learnerId: string) =>
    api<{
      items: {
        id: string;
        parent_id?: string;
        size_bytes?: number;
        file_count?: number;
        created_at?: string;
        created_by_job_id?: string;
      }[];
      head?: { snapshot_id?: string; version?: number };
    }>(`/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/snapshots`),
  readSnapshotFile: (campId: string, learnerId: string, snapshotId: string, path: string) =>
    api<import("./types").WorkspaceEntry & { snapshot_id?: string; status?: string }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/snapshots/${encodeURIComponent(snapshotId)}/file?path=${encodeURIComponent(path)}`,
    ),
  restoreSnapshot: (campId: string, learnerId: string, snapshot_id: string) =>
    api<{ ok: boolean; snapshot_id: string }>(
      `/api/v1/agent/workspaces/${encodeURIComponent(campId)}/${encodeURIComponent(learnerId)}/restore?snapshot_id=${encodeURIComponent(snapshot_id)}`,
      { method: "POST" },
    ),
  listJobs: (
    learnerId: string,
    opts?: { active_only?: boolean; camp_id?: string; node_id?: string; limit?: number },
  ) => {
    const q = new URLSearchParams();
    if (opts?.active_only) q.set("active_only", "true");
    if (opts?.camp_id) q.set("camp_id", opts.camp_id);
    if (opts?.node_id) q.set("node_id", opts.node_id);
    if (opts?.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return api<{
      items: {
        id: string;
        status: string;
        camp_id?: string;
        node_id?: string;
        created_at?: string;
      }[];
    }>(`/api/v1/agent/learners/${encodeURIComponent(learnerId)}/jobs${qs ? `?${qs}` : ""}`);
  },
  eventsUrl: (jobId: string) => `/api/v1/agent/jobs/${encodeURIComponent(jobId)}/events`,
};

/** Sim */
export const simApi = {
  create: (body: { sim_kind: string; task_spec?: Record<string, unknown>; learner_seed?: Record<string, unknown> }) =>
    api<{ session_id: string; sim_kind: string }>("/api/v1/sim/sessions", { method: "POST", body }),
  view: (sessionId: string) => api<Record<string, unknown>>(`/api/v1/sim/sessions/${encodeURIComponent(sessionId)}`),
  action: (sessionId: string, type: string, payload: Record<string, unknown> = {}) =>
    api(`/api/v1/sim/sessions/${encodeURIComponent(sessionId)}/actions`, {
      method: "POST",
      body: { type, payload },
    }),
  evaluate: (sessionId: string, rubric: import("./types").RubricCheck[]) =>
    api(`/api/v1/sim/sessions/${encodeURIComponent(sessionId)}/evaluate`, { method: "POST", body: { rubric } }),
  reset: (sessionId: string) =>
    api(`/api/v1/sim/sessions/${encodeURIComponent(sessionId)}/reset`, { method: "POST" }),
};

/** SQL Lab (M4) — isolated Postgres sandbox sessions */
export const sqlLabApi = {
  create: (body: { camp_id?: string; day?: number; node_id?: string; seed_sql?: string[] }) =>
    api<{ session_id: string; expires_in?: number; camp_id?: string; day?: number; node_id?: string }>(
      "/api/v1/sql-lab/sessions",
      { method: "POST", body },
    ),
  exec: (sessionId: string, sql: string) =>
    api<{ columns: string[]; rows: Record<string, unknown>[]; rowcount: number; duration_ms: number }>(
      `/api/v1/sql-lab/sessions/${encodeURIComponent(sessionId)}/exec`,
      { method: "POST", body: { sql } },
    ),
  schema: (sessionId: string) =>
    api<{ schema: string; tables: { name: string; columns: { column_name: string; data_type: string }[] }[] }>(
      `/api/v1/sql-lab/sessions/${encodeURIComponent(sessionId)}/schema`,
    ),
  reset: (sessionId: string) =>
    api<{ status: string }>(`/api/v1/sql-lab/sessions/${encodeURIComponent(sessionId)}/reset`, { method: "POST" }),
  evaluate: (sessionId: string, rubric: import("./types").RubricCheck[]) =>
    api<{ pass: boolean; checks: { id: string; ok: boolean; detail: string }[]; score: number }>(
      `/api/v1/sql-lab/sessions/${encodeURIComponent(sessionId)}/evaluate`,
      { method: "POST", body: { rubric } },
    ),
  destroy: (sessionId: string) =>
    api<{ status: string }>(`/api/v1/sql-lab/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
};

/** Learner lab attachments (M4) — bound to an attempt/submission, never
 * auto-ingested into RAG (`rag_eligible=false` by default). */
export const labAttachmentsApi = {
  upload: (file: File, meta: { camp_id?: string; day?: number; node_id?: string; attempt_id?: string; submission_id?: string }) => {
    const fd = new FormData();
    fd.append("file", file);
    if (meta.camp_id) fd.append("camp_id", meta.camp_id);
    if (meta.day != null) fd.append("day", String(meta.day));
    if (meta.node_id) fd.append("node_id", meta.node_id);
    if (meta.attempt_id) fd.append("attempt_id", meta.attempt_id);
    if (meta.submission_id) fd.append("submission_id", meta.submission_id);
    return api<{ id: string; filename: string; size_bytes: number; scan_status: string; rag_eligible: boolean }>(
      "/api/v1/labs/attachments",
      { method: "POST", formData: fd },
    );
  },
  list: (params?: { attempt_id?: string; submission_id?: string; day?: number; node_id?: string; camp_id?: string }) => {
    const q = new URLSearchParams();
    if (params?.attempt_id) q.set("attempt_id", params.attempt_id);
    if (params?.submission_id) q.set("submission_id", params.submission_id);
    if (params?.day != null) q.set("day", String(params.day));
    if (params?.node_id) q.set("node_id", params.node_id);
    if (params?.camp_id) q.set("camp_id", params.camp_id);
    const qs = q.toString();
    return api<{ items: Record<string, unknown>[] }>(`/api/v1/labs/attachments${qs ? `?${qs}` : ""}`);
  },
};

/** Learner-facing submissions (project reflections, lab retries, etc). */
export const submissionsApi = {
  get: (params: { camp_id?: string; day: number; node_id: string }) => {
    const q = new URLSearchParams();
    q.set("day", String(params.day));
    q.set("node_id", params.node_id);
    if (params.camp_id) q.set("camp_id", params.camp_id);
    return api<{ item: import("./types").Submission | null }>(`/api/v1/submissions?${q.toString()}`);
  },
  create: (body: {
    camp_id?: string;
    day: number;
    node_id: string;
    job_id?: string | null;
    snapshot_id?: string | null;
    eval?: Record<string, unknown>;
  }) => api<{ id: string; snapshot_id?: string | null; status: string }>("/api/v1/submissions", { method: "POST", body }),
};

/** Progress */
export const progressApi = {
  evidence: (learnerId: string) =>
    api<{ items: Record<string, unknown>[] }>(`/api/v1/learners/${encodeURIComponent(learnerId)}/evidence`),
  passport: (learnerId: string) =>
    api<import("./types").Passport>(`/api/v1/learners/${encodeURIComponent(learnerId)}/passport`),
  writeEvidence: (body: {
    learner_id: string;
    camp_version?: string;
    day: number;
    node_id: string;
    kind: string;
    payload?: Record<string, unknown>;
    capability_tags?: string[];
  }) => api("/api/v1/evidence", { method: "POST", body }),
};

/** Learner workbench study time (per training day). */
export const learningApi = {
  dailySummary: (params: { camp_id: string; day: number }) => {
    const q = new URLSearchParams();
    q.set("camp_id", params.camp_id);
    q.set("day", String(params.day));
    return api<import("./types").LearningDailySummary>(`/api/v1/learning/daily-summary?${q.toString()}`);
  },
  heartbeat: (body: { camp_id: string; day: number; delta_seconds: number }) =>
    api<{ ok: boolean; study_seconds: number; delta_seconds: number }>("/api/v1/learning/heartbeat", {
      method: "POST",
      body,
    }),
};

/** Public site content (landing page) */
export const siteApi = {
  landing: () => api<import("./types").LandingPayload>("/api/v1/site/landing", { skipRefresh: true }),
  contact: (body: import("./types").ContactLeadBody) =>
    api<{ ok: boolean; id: string }>("/api/v1/site/contact", { method: "POST", body, skipRefresh: true }),
};

/** Learner profile / identity / certificates */
export const meApi = {
  profile: () => api<import("./types").LearnerProfile>("/api/v1/me/profile"),
  updateProfile: (body: { display_name?: string; bio?: string }) =>
    api<import("./types").LearnerProfile>("/api/v1/me/profile", { method: "PATCH", body }),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    return api<{ ok: boolean; avatar_url: string; profile: import("./types").LearnerProfile }>(
      "/api/v1/me/profile/avatar",
      { method: "POST", formData: fd },
    );
  },
  /** Served by services/auth/app.py (M1 enrollment_records model) */
  enrollments: () =>
    api<{ items: import("./types").EnrollmentRecord[]; active_enrollment_id: string | null }>(
      "/api/v1/me/enrollments",
    ),
  certificates: () =>
    api<{ items: import("./types").CertificateItem[]; source: string }>("/api/v1/me/certificates"),
  startIdentity: (body: { real_name: string; id_number: string }) =>
    api<import("./types").IdentityStartResult>("/api/v1/me/identity/start", { method: "POST", body }),
};

/** Public certificate verification (no auth) */
export const certApi = {
  verify: (certId: string) =>
    api<import("./types").CertificateVerifyResult>(
      `/api/v1/certificates/${encodeURIComponent(certId)}/verify`,
      { skipRefresh: true },
    ),
  verifyChallenge: (body: import("./types").CertificateVerifyBody) =>
    api<import("./types").CertificateVerifyResult>("/api/v1/certificates/verify", {
      method: "POST",
      body,
      skipRefresh: true,
    }),
};

/** Certificate chain explorer (public) */
export const chainApi = {
  stats: () => api<Record<string, unknown>>("/api/v1/chain/stats", { skipRefresh: true }),
  algorithms: () => api<Record<string, unknown>>("/api/v1/chain/algorithms", { skipRefresh: true }),
  blocks: (limit = 20, offset = 0) =>
    api<{ items: Record<string, unknown>[] }>(`/api/v1/chain/blocks?limit=${limit}&offset=${offset}`, {
      skipRefresh: true,
    }),
  block: (height: number) =>
    api<{ block: Record<string, unknown> }>(`/api/v1/chain/blocks/${height}`, { skipRefresh: true }),
  tx: (hash: string) =>
    api<{ transaction: Record<string, unknown> }>(`/api/v1/chain/tx/${encodeURIComponent(hash)}`, {
      skipRefresh: true,
    }),
  cert: (certId: string) =>
    api<{ cert_id: string; transactions: Record<string, unknown>[] }>(
      `/api/v1/chain/cert/${encodeURIComponent(certId)}`,
      { skipRefresh: true },
    ),
  verify: () => api<{ valid: boolean; errors: string[] }>("/api/v1/chain/verify", { skipRefresh: true }),
};

/** Kb memories */
export const kbApi = {
  uploadMemory: (body: { content: string; title?: string; camp_id?: string; tags?: string[] }) =>
    api<Record<string, unknown>>("/api/v1/kb/memories", { method: "POST", body }),
};

/** Author — mix of existing + planned production paths */
export const authorApi = {
  uploadContract: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api("/api/v1/author/contracts/upload", { method: "POST", formData: fd });
  },
  evidence: (learnerId?: string) =>
    api<{ items: Record<string, unknown>[] }>(
      `/api/v1/author/evidence${learnerId ? `?learner_id=${encodeURIComponent(learnerId)}` : ""}`,
    ),
  jobs: (learnerId?: string) =>
    api<{ items: Record<string, unknown>[] }>(
      `/api/v1/author/jobs${learnerId ? `?learner_id=${encodeURIComponent(learnerId)}` : ""}`,
    ),
  /** Planned: POST /api/v1/author/documents */
  uploadDocument: (file: File, campId: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("camp_id", campId);
    return api<import("./types").AuthorDocument>("/api/v1/author/documents", { method: "POST", formData: fd });
  },
  listDocuments: (params?: ListQuery & { camp_id?: string; status?: string; bound?: string }) => {
    const qs = toQuery(params);
    return api<Paginated<import("./types").AuthorDocument>>(
      `/api/v1/author/documents${qs ? `?${qs}` : ""}`,
    );
  },
  getDocument: (docId: string) =>
    api<import("./types").AuthorDocument>(`/api/v1/author/documents/${encodeURIComponent(docId)}`),
  deleteDocument: (docId: string) =>
    api<{ ok: boolean; id: string; bindings_cleared: number }>(
      `/api/v1/author/documents/${encodeURIComponent(docId)}`,
      { method: "DELETE" },
    ),
  unbindDocument: (docId: string, bindingId: string) =>
    api<{ ok: boolean; binding_id: string }>(
      `/api/v1/author/documents/${encodeURIComponent(docId)}/bindings/${encodeURIComponent(bindingId)}`,
      { method: "DELETE" },
    ),
  bindDocument: (docId: string, body: { day: number; course_version_id?: string; capsule_id?: string }) =>
    api(`/api/v1/author/documents/${encodeURIComponent(docId)}/bind`, { method: "POST", body }),
  retryDocument: (docId: string) =>
    api<{ ok: boolean; ingest_job_id: string }>(
      `/api/v1/author/documents/${encodeURIComponent(docId)}/retry`,
      { method: "POST", body: {} },
    ),
  documentDownloadUrl: (docId: string) =>
    api<{ url: string; expires_in: number }>(
      `/api/v1/author/documents/${encodeURIComponent(docId)}/download-url`,
    ),
  listCourseVersions: (campId: string) =>
    api<{ items: import("./types").CourseVersion[] }>(
      `/api/v1/author/course-versions?camp_id=${encodeURIComponent(campId)}`,
    ),
  publishCourseVersion: (body: { camp_id: string; version_tag: string; title?: string; note?: string }) =>
    api("/api/v1/author/course-versions/publish", { method: "POST", body }),
  listCourses: () => api<{ items: import("./types").AuthorCourse[] }>("/api/v1/author/courses"),
  listCoursesPaged: (params?: ListQuery & { status?: string }) => {
    const qs = toQuery(params);
    return api<Paginated<import("./types").AuthorCourse>>(`/api/v1/author/courses${qs ? `?${qs}` : ""}`);
  },
  createCourse: (body: { title: string; slug: string; description?: string }) =>
    api<{ ok: boolean; id: string }>("/api/v1/author/courses", { method: "POST", body }),
  patchCourse: (courseId: string, body: { title?: string; description?: string; status?: string }) =>
    api<{ ok: boolean }>(`/api/v1/author/courses/${encodeURIComponent(courseId)}`, { method: "PATCH", body }),
  listCourseVersionsPaged: (params?: ListQuery & { camp_id?: string; course_id?: string; status?: string }) => {
    const qs = toQuery(params);
    return api<Paginated<import("./types").AuthorCourseVersion>>(
      `/api/v1/author/course-versions${qs ? `?${qs}` : ""}`,
    );
  },
  validateCourseYaml: (files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    return api<{
      ok: boolean;
      days: number;
      titles?: string[];
      errors?: string[];
      packages?: Record<string, unknown>[];
    }>("/api/v1/author/course-versions/validate-yaml", { method: "POST", formData: fd });
  },
  listVersionsForCourse: (courseId: string) =>
    api<{ items: import("./types").AuthorCourseVersion[] }>(
      `/api/v1/author/courses/${encodeURIComponent(courseId)}/versions`,
    ),
  createCourseVersion: (
    courseId: string,
    body: { version_tag: string; title?: string; clone_from_version_id?: string; camp_id?: string; files?: File[] },
  ) => {
    const fd = new FormData();
    fd.append("version_tag", body.version_tag);
    fd.append("title", body.title || "");
    if (body.clone_from_version_id) fd.append("clone_from_version_id", body.clone_from_version_id);
    if (body.camp_id) fd.append("camp_id", body.camp_id);
    for (const f of body.files || []) fd.append("files", f);
    return api<{ ok: boolean; course_version_id: string; status: string; days: number }>(
      `/api/v1/author/courses/${encodeURIComponent(courseId)}/versions`,
      { method: "POST", formData: fd },
    );
  },
  listCourseVersionDays: (versionId: string) =>
    api<{ items: { day: number; title: string; project?: string | null }[] }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/days`,
    ),
  getCourseVersion: (versionId: string) =>
    api<{
      id: string;
      camp_id?: string | null;
      course_id?: string | null;
      version_tag: string;
      status: string;
      title: string;
      source?: string | null;
      published_at?: string | null;
      created_at?: string;
      course_title?: string | null;
      course_slug?: string | null;
      day_count?: number;
    }>(`/api/v1/author/course-versions/${encodeURIComponent(versionId)}`),
  getCourseVersionDay: (versionId: string, day: number) =>
    api<{ day: number; title: string; project?: string | null; package_json: Record<string, unknown> }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/days/${day}`,
    ),
  createCourseVersionDay: (
    versionId: string,
    body: { day?: number; title?: string; week?: number; clone_from_day?: number } = {},
  ) =>
    api<{ ok: boolean; course_version_id: string; day: number; title: string; package_json: Record<string, unknown> }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/days`,
      { method: "POST", body },
    ),
  deleteCourseVersionDay: (versionId: string, day: number) =>
    api<{ ok: boolean; course_version_id: string; day: number }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/days/${day}`,
      { method: "DELETE" },
    ),
  uploadCourseMedia: (
    versionId: string,
    body: { file: File; day: number; capsule_id: string; kind: "video" | "audio" | "poster" | "image" },
  ) => {
    const fd = new FormData();
    fd.append("file", body.file);
    fd.append("day", String(body.day));
    fd.append("capsule_id", body.capsule_id);
    fd.append("kind", body.kind);
    return api<{
      ok: boolean;
      object_key: string;
      kind: string;
      content_type: string;
      size_bytes: number;
      filename: string;
      stream_url: string;
    }>(`/api/v1/author/course-versions/${encodeURIComponent(versionId)}/media`, {
      method: "POST",
      formData: fd,
    });
  },
  updateCourseVersionDay: (
    versionId: string,
    day: number,
    body: { package_json: Record<string, unknown>; title?: string; project?: string | null },
  ) =>
    api<{ ok: boolean; course_version_id: string; day: number }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/days/${day}`,
      { method: "PUT", body },
    ),
  listBootcampDays: () => api<{ items: number[] }>("/api/v1/author/bootcamp/days"),
  syncBootcamp: (
    versionId: string,
    body: { days?: number[]; dry_run?: boolean; merge_mode?: "full" | "media_fields" },
  ) =>
    api<{
      dry_run: boolean;
      merge_mode?: string;
      days?: Array<{
        day: number;
        title: string;
        capsule_count: number;
        capsules: Array<{ id: string; title?: string; media_count?: number; knowledge_cards_count?: number }>;
        changes: string[];
      }>;
      updated?: number[];
      errors?: Array<{ day: number; error: string }>;
    }>(`/api/v1/author/course-versions/${encodeURIComponent(versionId)}/sync-bootcamp`, {
      method: "POST",
      body,
    }),
  getBootcampCapsuleMedia: (day: number, capsuleId: string) =>
    api<{ day: number; capsule_id: string; items: import("./types").CapsuleMedia[] }>(
      `/api/v1/author/bootcamp/days/${day}/capsules/${encodeURIComponent(capsuleId)}/media`,
    ),
  publishCourseVersionById: (versionId: string, note?: string) =>
    api<{ ok: boolean; course_version_id: string; status: string }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/publish`,
      { method: "POST", body: { note: note || "" } },
    ),
  rollbackCourseVersion: (versionId: string) =>
    api<{ ok: boolean; course_version_id: string; status: string; rolled_back_from: string; days: number }>(
      `/api/v1/author/course-versions/${encodeURIComponent(versionId)}/rollback`,
      { method: "POST", body: {} },
    ),
  listSubmissions: (params?: { camp_id?: string; day?: number }) => {
    const q = new URLSearchParams();
    if (params?.camp_id) q.set("camp_id", params.camp_id);
    if (params?.day != null) q.set("day", String(params.day));
    const qs = q.toString();
    return api<{ items: import("./types").Submission[] }>(`/api/v1/author/submissions${qs ? `?${qs}` : ""}`);
  },
  setCampKey: (campId: string, lingzhi_api_key: string) =>
    api<{ ok: boolean; camp_id: string; masked: string }>(
      `/api/v1/author/camps/${encodeURIComponent(campId)}/key`,
      { method: "PUT", body: { lingzhi_api_key } },
    ),
  /** M5 — 导师复核队列（AI 教练 handoff 之后由教研/导师处理）。 */
  listMentorReviews: (params?: { status?: string; camp_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status !== undefined) q.set("status", params.status);
    if (params?.camp_id) q.set("camp_id", params.camp_id);
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return api<{ items: import("./types").MentorReview[] }>(`/api/v1/author/reviews${qs ? `?${qs}` : ""}`);
  },
  submitMentorReviewFeedback: (
    reviewId: string,
    body: { feedback: string; score?: number; status?: "resolved" | "pending" },
  ) =>
    api<{ ok: boolean; id: string; status: string; submission_id?: string | null }>(
      `/api/v1/author/reviews/${encodeURIComponent(reviewId)}/feedback`,
      { method: "POST", body },
    ),
  listOpenCourseCategories: () =>
    api<{ items: import("./types").LandingOpenCourseCategory[] }>(
      "/api/v1/author/site/open-course-categories",
    ),
  upsertOpenCourseCategory: (body: {
    id?: string;
    name: string;
    sort_order?: number;
    published?: boolean;
  }) =>
    api<{
      item: import("./types").LandingOpenCourseCategory;
      items: import("./types").LandingOpenCourseCategory[];
    }>("/api/v1/author/site/open-course-categories", { method: "POST", body }),
  deleteOpenCourseCategory: (categoryId: string) =>
    api<{ items: import("./types").LandingOpenCourseCategory[] }>(
      `/api/v1/author/site/open-course-categories/${encodeURIComponent(categoryId)}`,
      { method: "DELETE" },
    ),
  listOpenCourses: () =>
    api<{ items: import("./types").LandingOpenCourse[] }>("/api/v1/author/site/open-courses"),
  upsertOpenCourse: (form: FormData | Record<string, unknown>) => {
    if (form instanceof FormData) {
      return api<{ item: import("./types").LandingOpenCourse; items: import("./types").LandingOpenCourse[] }>(
        "/api/v1/author/site/open-courses",
        { method: "POST", formData: form },
      );
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) {
      if (v == null) continue;
      if (v instanceof Blob) fd.append(k, v);
      else fd.append(k, String(v));
    }
    return api<{ item: import("./types").LandingOpenCourse; items: import("./types").LandingOpenCourse[] }>(
      "/api/v1/author/site/open-courses",
      { method: "POST", formData: fd },
    );
  },
  deleteOpenCourse: (courseId: string) =>
    api<{ items: import("./types").LandingOpenCourse[] }>(
      `/api/v1/author/site/open-courses/${encodeURIComponent(courseId)}`,
      { method: "DELETE" },
    ),
  overview: (campId?: string) =>
    api<{
      courses: number;
      draft_versions: number;
      pending_submissions: number;
      documents: number;
      videos: number;
      videos_library?: number;
      videos_open_courses?: number;
      videos_site?: number;
      learners: number;
      open_courses?: number;
      contact_leads?: number;
      paid_orders?: number;
      gross_fen?: number;
      shared_fen?: number;
      pending_share_fen?: number;
      recent_actions?: { title: string; at?: string; href?: string }[];
      pending_reviews?: number;
      learn_active_users_7d?: { date: string; users: number }[];
      learn_duration_minutes_7d?: { date: string; minutes: number }[];
      open_course_clicks_7d?: { date: string; count: number }[];
      capsule_opens_7d?: { date: string; opens: number }[];
      submission_trend_7d?: { date: string; count: number }[];
      metrics_note?: Record<string, string>;
    }>(`/api/v1/author/overview${campId ? `?camp_id=${encodeURIComponent(campId)}` : ""}`),
  financeDashboard: () =>
    api<{
      ok: boolean;
      paid_orders: number;
      paid_users: number;
      gross_fen: number;
      shared_fen: number;
      pending_share_fen: number;
      failed_share_fen: number;
      finished_share_count: number;
      pending_share_count: number;
      failed_share_count: number;
      gross_trend_7d?: Array<{ date: string; gross_fen?: number; orders?: number }>;
      shared_trend_7d?: Array<{ date: string; shared_fen?: number; shares?: number }>;
      orgs?: Array<{
        id: string;
        name: string;
        paid_orders: number;
        gross_fen: number;
        shared_fen: number;
        pending_share_fen: number;
      }>;
      recent_orders?: Array<{
        id: string;
        out_trade_no?: string;
        amount_fen: number;
        paid_at?: string;
        org_id?: string | null;
        org_name?: string | null;
        user_email?: string | null;
        share_fen?: number | null;
        rate_bps?: number | null;
        wx_state?: string | null;
        error_message?: string | null;
      }>;
    }>("/api/v1/author/finance/dashboard"),
  getSiteLanding: () => api<Record<string, unknown>>("/api/v1/author/site/landing"),
  patchSiteLanding: (body: Record<string, unknown>) =>
    api<Record<string, unknown>>("/api/v1/author/site/landing", { method: "PATCH", body }),
  uploadSiteHero: (form: FormData) =>
    api<Record<string, unknown>>("/api/v1/author/site/hero", { method: "POST", formData: form }),
  uploadMentorAvatar: (mentorId: string, file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    return api<Record<string, unknown>>(
      `/api/v1/author/site/mentors/${encodeURIComponent(mentorId)}/avatar`,
      { method: "POST", formData: fd },
    );
  },
  listOpenCoursesPaged: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/site/open-courses${qs ? `?${qs}` : ""}`);
  },
  listContactLeads: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/site/contact-leads${qs ? `?${qs}` : ""}`);
  },
  listMediaAssets: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/media-assets${qs ? `?${qs}` : ""}`);
  },
  uploadMediaAsset: (body: FormData | Record<string, unknown>) => {
    if (body instanceof FormData) {
      return api<any>("/api/v1/author/media-assets", { method: "POST", formData: body });
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (v == null) continue;
      if (v instanceof Blob) fd.append(k, v);
      else fd.append(k, String(v));
    }
    return api<any>("/api/v1/author/media-assets", { method: "POST", formData: fd });
  },
  patchMediaAsset: (id: string, body: Record<string, unknown>) =>
    api<any>(`/api/v1/author/media-assets/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteMediaAsset: (id: string) =>
    api<any>(`/api/v1/author/media-assets/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listResourcePacks: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/resource-packs${qs ? `?${qs}` : ""}`);
  },
  createResourcePack: (body: Record<string, unknown>) =>
    api<any>("/api/v1/author/resource-packs", { method: "POST", body }),
  patchResourcePack: (id: string, body: Record<string, unknown>) =>
    api<any>(`/api/v1/author/resource-packs/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  deleteResourcePack: (id: string) =>
    api<any>(`/api/v1/author/resource-packs/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getResourcePack: (id: string) => api<any>(`/api/v1/author/resource-packs/${encodeURIComponent(id)}`),
  listPackResources: (packId: string, params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<Paginated<Record<string, unknown>>>(
      `/api/v1/author/resource-packs/${encodeURIComponent(packId)}/resources${qs ? `?${qs}` : ""}`,
    );
  },
  linkPackResource: (
    packId: string,
    body: {
      kind: string;
      title: string;
      object_key?: string;
      url?: string;
      day_index?: number;
      course_version_id?: string;
      node_id?: string;
    },
  ) =>
    api(`/api/v1/author/resource-packs/${encodeURIComponent(packId)}/resources`, { method: "POST", body }),
  deletePackResource: (packId: string, resourceId: string) =>
    api(`/api/v1/author/resource-packs/${encodeURIComponent(packId)}/resources/${encodeURIComponent(resourceId)}`, {
      method: "DELETE",
    }),
  listEnrollments: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/enrollments${qs ? `?${qs}` : ""}`);
  },
  getEnrollment: (id: string) =>
    api<{
      id: string;
      user_id: string;
      display_name?: string;
      email?: string;
      course_title?: string;
      version_tag?: string;
      status: string;
      progress_pct?: number;
      node_progress?: Array<{ day: number; node_id: string; status: string; updated_at?: string }>;
      capsule_progress?: Array<{ day: number; capsule_id: string; opened_at?: string }>;
      submission_count?: number;
      attachment_count?: number;
      mentor_reviews?: Array<{ id: string; day: number; node_id?: string; status: string }>;
    }>(`/api/v1/author/enrollments/${encodeURIComponent(id)}`),
  listOfferings: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/offerings${qs ? `?${qs}` : ""}`);
  },
  patchOffering: (id: string, body: { price_fen?: number; title?: string; status?: string }) =>
    api<{ item: Record<string, unknown> }>(`/api/v1/author/offerings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),
  createEnrollment: (body: Record<string, unknown>) =>
    api<any>("/api/v1/author/enrollments", { method: "POST", body }),
  patchEnrollment: (id: string, body: Record<string, unknown>) =>
    api<any>(`/api/v1/author/enrollments/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  issueCertificate: (body: {
    enrollment_id: string;
    allow_unverified?: boolean;
    mentor_approved?: boolean;
    min_completion_rate?: number;
  }) => api<any>("/api/v1/author/certificates/issue", { method: "POST", body }),
  revokeCertificate: (certId: string, reason: string) =>
    api<any>(`/api/v1/author/certificates/${encodeURIComponent(certId)}/revoke`, {
      method: "POST",
      body: { reason },
    }),
  listSubmissionsPaged: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== "") q.set(k, String(v));
    }
    const qs = q.toString();
    return api<any>(`/api/v1/author/submissions${qs ? `?${qs}` : ""}`);
  },
  getSubmission: (id: string) => api<any>(`/api/v1/author/submissions/${encodeURIComponent(id)}`),
  getSubmissionAttachments: (id: string) =>
    api<any>(`/api/v1/author/submissions/${encodeURIComponent(id)}/attachments`),
  reviewSubmission: (id: string, body: Record<string, unknown>) =>
    api<any>(`/api/v1/author/submissions/${encodeURIComponent(id)}/review`, { method: "POST", body }),
};

/** Partner channels (author) */
export const partnerAdminApi = {
  listOrgs: () => api<{ items: Record<string, unknown>[] }>("/api/v1/author/partners/orgs"),
  createOrg: (body: Record<string, unknown>) =>
    api<{ org: Record<string, unknown> }>("/api/v1/author/partners/orgs", { method: "POST", body }),
  updateOrg: (orgId: string, body: Record<string, unknown>) =>
    api<{ org: Record<string, unknown> }>(`/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}`, {
      method: "PUT",
      body,
    }),
  listInviteCodes: (orgId: string) =>
    api<{ items: Record<string, unknown>[] }>(
      `/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}/invite-codes`,
    ),
  createInviteCode: (orgId: string, body: { code: string; offering_id?: string; max_uses?: number }) =>
    api<{ invite_code: Record<string, unknown> }>(
      `/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}/invite-codes`,
      { method: "POST", body },
    ),
  getTiers: (orgId: string) =>
    api<{ items: { min_paid_users: number; rate_bps: number }[] }>(
      `/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}/tiers`,
    ),
  setTiers: (orgId: string, tiers: { min_paid_users: number; rate_bps: number }[]) =>
    api<{ items: { min_paid_users: number; rate_bps: number }[] }>(
      `/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}/tiers`,
      { method: "PUT", body: { tiers } },
    ),
  listAttributions: (orgId: string) =>
    api<{ items: Record<string, unknown>[] }>(
      `/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}/attributions`,
    ),
  createAccount: (orgId: string, body: { email: string; password: string; display_name?: string }) =>
    api<{ email: string; org_id: string }>(
      `/api/v1/author/partners/orgs/${encodeURIComponent(orgId)}/accounts`,
      { method: "POST", body },
    ),
};

/** Billing */
export const billingApi = {
  listOfferings: () => api<{ items: Record<string, unknown>[] }>("/api/v1/billing/offerings"),
  checkout: (
    offering_id: string,
    channel: "wechat" | "alipay" = "wechat",
    pay_mode: "auto" | "native" | "jsapi" = "auto",
  ) =>
    api<{
      order_id: string;
      out_trade_no: string;
      amount_fen: number;
      code_url?: string | null;
      pay_channel?: string;
      pay_mode?: "native" | "jsapi";
      jsapi_params?: {
        appId: string;
        timeStamp: string;
        nonceStr: string;
        package: string;
        signType: string;
        paySign: string;
      };
      dev_mode?: boolean;
      status: string;
      reused?: boolean;
    }>("/api/v1/billing/checkout", { method: "POST", body: { offering_id, channel, pay_mode } }),
  getOrder: (orderId: string) => api<{ order: Record<string, unknown> }>(`/api/v1/billing/orders/${encodeURIComponent(orderId)}`),
  syncOrder: (orderId: string) =>
    api<{ status: string; order: Record<string, unknown> }>(`/api/v1/billing/orders/${encodeURIComponent(orderId)}/sync`, {
      method: "POST",
    }),
  devMarkPaid: (orderId: string) =>
    api<{ order: Record<string, unknown> }>(`/api/v1/billing/dev/mark-paid/${encodeURIComponent(orderId)}`, {
      method: "POST",
    }),
};

export type PartnerReceiverStatus = {
  bound: boolean;
  wx_receiver_type?: string | null;
  wx_receiver_account_masked?: string | null;
  wx_receiver_name?: string | null;
  oauth_configured?: boolean;
};

/** Partner portal */
export const partnerApi = {
  login: (email: string, password: string) =>
    api<{
      token: string;
      csrf: string;
      user: import("./types").User;
      org_id: string;
      camp_id?: string | null;
      camps?: import("./types").Camp[];
      receiver?: PartnerReceiverStatus | null;
      default_home?: string;
      portals?: import("./types").AuthPortal[];
    }>("/api/v1/partner/auth/login", {
      method: "POST",
      body: { email, password },
      skipRefresh: true,
    }),
  dashboard: () =>
    api<{
      org: Record<string, unknown>;
      stats: Record<string, unknown>;
      user: { id: string; email: string };
      receiver?: PartnerReceiverStatus;
    }>("/api/v1/partner/dashboard"),
  attributions: () => api<{ items: Record<string, unknown>[] }>("/api/v1/partner/attributions"),
  profitShares: () => api<{ items: Record<string, unknown>[] }>("/api/v1/partner/profit-shares"),
  wechatReceiver: () => api<PartnerReceiverStatus>("/api/v1/partner/wechat/receiver"),
  wechatBindUrl: () =>
    api<{ authorize_url: string; state: string; redirect_uri: string; expires_in?: number }>(
      "/api/v1/partner/wechat/bind-url",
    ),
  wechatBindStatus: (state: string) =>
    api<{
      pending: boolean;
      done: boolean;
      expired: boolean;
      receiver: PartnerReceiverStatus;
    }>(`/api/v1/partner/wechat/bind-status?state=${encodeURIComponent(state)}`),
  offerings: () =>
    api<{
      items: Array<{
        id: string;
        title: string;
        course_title?: string | null;
        description?: string | null;
        price_fen: number;
        status: string;
        cover_image?: string | null;
        modules?: Array<{ day_index: number; title: string }>;
        module_count?: number;
        gallery?: string[];
      }>;
      org: { id: string; name?: string | null };
    }>("/api/v1/partner/offerings"),
  invites: () =>
    api<{
      org: { id: string; name?: string | null };
      items: Array<{
        id: string;
        code: string;
        status: string;
        max_uses?: number | null;
        used_count: number;
        offering_id?: string | null;
        register_url?: string | null;
        enroll_url?: string | null;
      }>;
      primary: {
        id: string;
        code: string;
        status: string;
        register_url?: string | null;
        enroll_url?: string | null;
      } | null;
    }>("/api/v1/partner/invites"),
};

export type ReferralDashboard = {
  code: string;
  register_url: string;
  invite_count: number;
  rate_bps: number;
  rate_percent: number;
  next_tier: {
    min_invites: number;
    rate_bps: number;
    rate_percent: number;
    invites_needed: number;
  } | null;
  attributions: Array<Record<string, unknown>>;
  profit_shares: Array<Record<string, unknown>>;
  receiver: { bound: boolean; wx_mp_openid?: string | null };
};

/** Learner referral / commission (profile invite tab). */
export const referralApi = {
  dashboard: () => api<ReferralDashboard>("/api/v1/me/referral"),
  attributions: () => api<{ items: Record<string, unknown>[] }>("/api/v1/me/referral/attributions"),
  profitShares: () => api<{ items: Record<string, unknown>[] }>("/api/v1/me/referral/profit-shares"),
  invites: () => api<{ code: string; register_url: string }>("/api/v1/me/referral/invites"),
};

/** Public share poster upload — returns URL WeChat can long-press save. */
export const shareApi = {
  uploadPoster: (file: Blob, filename = "poster.png") => {
    const fd = new FormData();
    fd.append("file", file, filename);
    return api<{ id: string; url: string; absolute_url: string }>("/api/v1/share/posters", {
      method: "POST",
      formData: fd,
    });
  },
};
