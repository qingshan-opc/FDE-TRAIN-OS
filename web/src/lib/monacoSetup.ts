/**
 * Use bundled monaco-editor instead of @monaco-editor/loader CDN (jsdelivr),
 * which often hangs in CN / offline environments and leaves "加载编辑器…" forever.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

let configured = false;

export function ensureMonacoLoader() {
  if (configured) return;
  configured = true;
  loader.config({ monaco });
}

ensureMonacoLoader();
