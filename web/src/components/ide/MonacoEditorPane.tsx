import { useEffect, useRef } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { monacoLanguageOf } from "../../lib/fileTypes";
import { ensureMonacoLoader } from "../../lib/monacoSetup";

export type IdeDiagnostic = {
  path: string;
  message: string;
  severity: string;
  line: number;
  column: number;
};

let monacoConfigured = false;
const viewStateCache = new Map<string, unknown>();

async function ensureMonacoYaml() {
  if (monacoConfigured) return;
  monacoConfigured = true;
  try {
    const monaco = await loader.init();
    const { configureMonacoYaml } = await import("monaco-yaml");
    configureMonacoYaml(monaco, {
      enableSchemaRequest: false,
      validate: true,
      hover: true,
      completion: true,
      isKubernetes: true,
      schemas: [
        {
          uri: "https://fde.local/schemas/k8s-deployment.json",
          fileMatch: ["**/deployment.yaml", "**/deployment.yml", "**/*-deployment.yaml"],
          schema: {
            type: "object",
            required: ["apiVersion", "kind", "metadata", "spec"],
            properties: {
              apiVersion: { type: "string" },
              kind: { type: "string", enum: ["Deployment", "Service", "ConfigMap", "Pod"] },
              metadata: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  labels: { type: "object", additionalProperties: { type: "string" } },
                },
                required: ["name"],
              },
              spec: { type: "object" },
            },
          },
        },
      ],
    });
  } catch {
    /* monaco-yaml optional */
  }
}

function severityLabel(monaco: typeof import("monaco-editor"), n: number): string {
  if (n === monaco.MarkerSeverity.Error) return "error";
  if (n === monaco.MarkerSeverity.Warning) return "warning";
  if (n === monaco.MarkerSeverity.Info) return "info";
  return "hint";
}

export function MonacoEditorPane({
  path,
  value,
  editable,
  onChange,
  onSave,
  onDiagnostics,
  revealLine,
}: {
  path: string | null;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  onSave?: () => void;
  onDiagnostics?: (count: number, items: IdeDiagnostic[]) => void;
  revealLine?: number | null;
}) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const pathRef = useRef<string | null>(path);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);

  useEffect(() => {
    ensureMonacoLoader();
    void ensureMonacoYaml();
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (pathRef.current && pathRef.current !== path) {
      viewStateCache.set(pathRef.current, editor.saveViewState());
    }
    pathRef.current = path;
    if (path) {
      const vs = viewStateCache.get(path);
      if (vs) editor.restoreViewState(vs as never);
      editor.focus();
    }
  }, [path]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || revealLine == null || revealLine < 1) return;
    editor.revealLineInCenter(revealLine);
    editor.setPosition({ lineNumber: revealLine, column: 1 });
    editor.focus();
  }, [revealLine, path]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (path) {
      const vs = viewStateCache.get(path);
      if (vs) editor.restoreViewState(vs as never);
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });
    const update = () => {
      if (!onDiagnostics || !path) return;
      const model = editor.getModel();
      if (!model) return;
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const items: IdeDiagnostic[] = markers
        .filter((m: { severity: number }) => m.severity <= monaco.MarkerSeverity.Warning)
        .map((m: { message: string; severity: number; startLineNumber: number; startColumn: number }) => ({
          path,
          message: m.message,
          severity: severityLabel(monaco, m.severity),
          line: m.startLineNumber,
          column: m.startColumn,
        }));
      onDiagnostics(items.length, items);
    };
    update();
    const sub = monaco.editor.onDidChangeMarkers(() => update());
    editor.onDidDispose(() => {
      if (pathRef.current) viewStateCache.set(pathRef.current, editor.saveViewState());
      sub.dispose();
    });
  };

  if (!path) {
    return <div className="lab-ide-editor-empty muted">选择左侧文件，或先「生成」作业</div>;
  }

  return (
    <div className="ide-monaco-wrap">
      <Editor
        height="100%"
        path={`file:///${path}`}
        language={monacoLanguageOf(path)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          readOnly: !editable,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          renderWhitespace: "selection",
          folding: true,
          padding: { top: 8 },
        }}
        loading={<div className="muted" style={{ padding: 16 }}>加载编辑器…</div>}
      />
    </div>
  );
}
