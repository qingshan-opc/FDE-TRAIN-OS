import type { CoachChatMessage } from "./coachChatTypes";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lightweight markdown-ish render for coach replies (no external deps). */
export function CoachCitationMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const html = lines
    .map((line) => {
      let s = escapeHtml(line);
      s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
      if (/^[-*]\s/.test(line)) {
        return `<li>${s.replace(/^[-*]\s/, "")}</li>`;
      }
      return s ? `<p>${s}</p>` : "";
    })
    .join("");
  return (
    <div
      className="coach-chat-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CoachMessage({ message }: { message: CoachChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`coach-msg ${isUser ? "coach-msg-user" : "coach-msg-bot"}`}>
      <div className={`coach-msg-bubble ${isUser ? "" : "coach-msg-answer"}`}>
        {isUser ? (
          message.text
        ) : (
          <>
            <CoachCitationMarkdown text={message.text || (message.streaming ? "…" : "")} />
            {message.streaming && <span className="coach-chat-cursor" aria-hidden>|</span>}
          </>
        )}
      </div>
      {!isUser && message.citations && message.citations.length > 0 && (
        <details className="coach-citations-wrap">
          <summary>引用 {message.citations.length} 条资料</summary>
          <ul className="coach-citations">
            {message.citations.slice(0, 5).map((c, i) => (
              <li key={i}>{c.title || c.id || "citation"}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
