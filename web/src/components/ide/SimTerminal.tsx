import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export function SimTerminal({
  lines,
  onSubmit,
  disabled,
  readOnly,
  title = "FDE Kubernetes 仿真终端（非真实集群）",
}: {
  lines: string[];
  onSubmit?: (cmd: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  title?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const bufRef = useRef("");
  const histRef = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    if (!hostRef.current || termRef.current) return;
    const term = new Terminal({
      convertEol: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      theme: { background: "#0f172a", foreground: "#e2e8f0", cursor: "#14b8a6" },
      cursorBlink: !readOnly,
      disableStdin: Boolean(readOnly),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    term.writeln(title);
    if (!readOnly) term.write("$ ");
    term.onData((data) => {
      if (disabled || readOnly || !onSubmitRef.current) return;
      const code = data.charCodeAt(0);
      if (data === "\r") {
        const cmd = bufRef.current.trim();
        term.writeln("");
        if (cmd) {
          histRef.current.push(cmd);
          histIdx.current = histRef.current.length;
          onSubmitRef.current(cmd);
        }
        bufRef.current = "";
        term.write("$ ");
        return;
      }
      if (code === 127) {
        if (bufRef.current.length) {
          bufRef.current = bufRef.current.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }
      if (data === "\u001b[A") {
        if (!histRef.current.length) return;
        histIdx.current = Math.max(0, histIdx.current - 1);
        const prev = histRef.current[histIdx.current] || "";
        while (bufRef.current.length) {
          bufRef.current = bufRef.current.slice(0, -1);
          term.write("\b \b");
        }
        bufRef.current = prev;
        term.write(prev);
        return;
      }
      if (data === "\u001b[B") {
        histIdx.current = Math.min(histRef.current.length, histIdx.current + 1);
        const next = histRef.current[histIdx.current] || "";
        while (bufRef.current.length) {
          bufRef.current = bufRef.current.slice(0, -1);
          term.write("\b \b");
        }
        bufRef.current = next;
        term.write(next);
        return;
      }
      if (code < 32) return;
      bufRef.current += data;
      term.write(data);
    });
    termRef.current = term;
    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
  }, [disabled, readOnly, title]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !lines.length) return;
    // In read-only mode dump full transcript when lines grow.
    if (readOnly) {
      term.clear();
      term.writeln(title);
      for (const line of lines.slice(-80)) term.writeln(line);
      return;
    }
    const last = lines[lines.length - 1];
    if (last) {
      term.writeln(last);
      if (!last.startsWith("$ ")) term.write("$ ");
    }
  }, [lines, readOnly, title]);

  return <div ref={hostRef} className="ide-xterm" aria-label="仿真终端" />;
}
