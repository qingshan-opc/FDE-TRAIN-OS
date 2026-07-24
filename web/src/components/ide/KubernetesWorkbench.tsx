import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { simApi } from "../../lib/api";
import { SimTerminal } from "./SimTerminal";

const MonacoEditorPane = lazy(() =>
  import("./MonacoEditorPane").then((m) => ({ default: m.MonacoEditorPane })),
);

type Resource = {
  kind?: string;
  name?: string;
  ready?: boolean;
  replicas?: number;
  desired?: number;
  fault?: string | null;
  phase?: string;
  image?: string;
};

const QUICK = [
  "kubectl get deploy",
  "kubectl get pods",
  "kubectl describe deployment/api",
  "kubectl apply -f deployment.yaml",
  "kubectl rollout status deployment/api",
  "kubectl logs pod/api-0",
];

export function KubernetesWorkbench({
  sessionId,
  view,
  busy,
  onAction,
  onRefresh,
}: {
  sessionId: string;
  view: Record<string, unknown> | null;
  busy?: boolean;
  onAction: (type: string, payload?: Record<string, unknown>) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const resources = (view?.resources || {}) as Record<string, Resource>;
  const events = (view?.events as string[]) || [];
  const hints = (view?.hints as string[]) || [];
  const [manifest, setManifest] = useState(String(view?.manifest || ""));
  const [selected, setSelected] = useState<string | null>("Deployment/api");
  const [termLines, setTermLines] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty && typeof view?.manifest === "string") {
      setManifest(view.manifest);
    }
  }, [view?.manifest, dirty]);

  const entries = useMemo(() => Object.entries(resources), [resources]);
  const selectedRes = selected ? resources[selected] : null;

  const runKubectl = async (cmd: string) => {
    const payload: Record<string, unknown> = { cmd };
    if (cmd.includes("apply")) {
      payload.manifest = manifest;
      if (dirty) {
        await onAction("manifest.set", { text: manifest });
        setDirty(false);
      }
    }
    const res = (await simApi.action(sessionId, "kubectl", payload)) as Record<string, unknown>;
    const stdout = String(res.stdout || "");
    setTermLines((prev) => [...prev, `$ ${cmd}`, stdout || "(no output)"]);
    await onRefresh();
  };

  return (
    <div className="k8s-workbench" aria-label="Kubernetes 仿真工作台">
      <div className="k8s-banner muted">
        仿真集群 · 非真实 Kubernetes · 命令走白名单，不会访问宿主机或公网
      </div>
      <div className="k8s-grid">
        <aside className="k8s-resources">
          <div className="lab-ide-files-head">资源</div>
          <ul className="file-tree">
            {entries.map(([key, r]) => (
              <li
                key={key}
                className={selected === key ? "selected" : ""}
                onClick={() => setSelected(key)}
              >
                <span>{key}</span>
                <span className={`k8s-ready ${r.ready ? "ok" : "bad"}`}>
                  {r.ready ? "Ready" : r.phase || "NotReady"}
                </span>
              </li>
            ))}
          </ul>
          {hints.length > 0 && (
            <div className="k8s-hints">
              {hints.map((h, i) => (
                <p key={i} className="muted" style={{ fontSize: 12 }}>
                  {h}
                </p>
              ))}
            </div>
          )}
        </aside>

        <div className="k8s-editor">
          <div className="lab-ide-preview-head">deployment.yaml {dirty ? "· 未同步" : ""}</div>
          <Suspense fallback={<div className="muted" style={{ padding: 12 }}>加载编辑器…</div>}>
            <MonacoEditorPane
              path="deployment.yaml"
              value={manifest}
              editable={!busy}
              onChange={(v) => {
                setManifest(v);
                setDirty(true);
              }}
              onSave={() => void onAction("manifest.set", { text: manifest }).then(() => setDirty(false))}
            />
          </Suspense>
        </div>

        <div className="k8s-side">
          <div className="lab-ide-preview-head">拓扑 / 详情</div>
          <div className="k8s-topology">
            {entries.map(([key, r]) => (
              <div key={key} className={`k8s-node ${r.ready ? "ok" : "bad"}`}>
                <strong>{key}</strong>
                <span>{r.ready ? "Ready" : "Waiting"}</span>
                {r.fault ? <span className="k8s-fault">{r.fault}</span> : null}
              </div>
            ))}
          </div>
          {selectedRes && (
            <pre className="k8s-describe">{JSON.stringify(selectedRes, null, 2)}</pre>
          )}
          <div className="lab-ide-preview-head">事件</div>
          <ul className="k8s-events">
            {events.slice().reverse().map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="k8s-term-wrap">
        <div className="row" style={{ gap: 6, flexWrap: "wrap", padding: "6px 8px" }}>
          {QUICK.map((c) => (
            <button key={c} type="button" disabled={busy} onClick={() => void runKubectl(c)}>
              {c.length > 40 ? `${c.slice(0, 40)}…` : c}
            </button>
          ))}
        </div>
        <SimTerminal lines={termLines} onSubmit={(cmd) => void runKubectl(cmd)} disabled={busy} />
      </div>
    </div>
  );
}
