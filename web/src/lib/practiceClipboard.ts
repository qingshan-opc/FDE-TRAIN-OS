import type { ClipboardEvent, DragEvent, KeyboardEvent } from "react";

/** Block copy / cut / paste on learner practice text fields. */
export function blockPracticeClipboard<T extends HTMLElement>() {
  const onCopy = (e: ClipboardEvent<T>) => {
    e.preventDefault();
  };
  const onCut = (e: ClipboardEvent<T>) => {
    e.preventDefault();
  };
  const onPaste = (e: ClipboardEvent<T>) => {
    e.preventDefault();
  };
  const onDrop = (e: DragEvent<T>) => {
    e.preventDefault();
  };
  const onDragOver = (e: DragEvent<T>) => {
    e.preventDefault();
  };
  /** Soft-block common shortcuts even if the browser skips clipboard events. */
  const onKeyDown = (e: KeyboardEvent<T>) => {
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && (key === "c" || key === "v" || key === "x" || key === "insert")) {
      e.preventDefault();
    }
    if (e.shiftKey && key === "insert") {
      e.preventDefault();
    }
  };
  return {
    onCopy,
    onCut,
    onPaste,
    onDrop,
    onDragOver,
    onKeyDown,
    spellCheck: true as const,
    autoComplete: "off" as const,
    "data-no-clipboard": "true",
    title: "练习作答请自行输入，不支持复制粘贴",
  };
}
