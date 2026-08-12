/** Partner console display helpers (mobile-friendly truncations). */

export function formatPartnerTime(raw: unknown): string {
  const s = String(raw || "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.length > 16 ? `${s.slice(0, 16)}…` : s;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Prefer readable name; fall back to shortened email / wx synthetic id. */
export function partnerIdentity(row: {
  display_name?: unknown;
  email?: unknown;
  user_email?: unknown;
}): { title: string; subtitle?: string } {
  const name = String(row.display_name || "").trim();
  const email = String(row.email || row.user_email || "").trim();
  if (name) {
    return {
      title: name,
      subtitle: email && email !== name ? shortenId(email) : undefined,
    };
  }
  if (email) return { title: shortenId(email) };
  return { title: "—" };
}

export function shortenId(raw: string, max = 22): string {
  const s = raw.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(8, max - 1))}…`;
}

export function fenYuan(fen: unknown): string {
  return (Number(fen || 0) / 100).toFixed(2);
}
