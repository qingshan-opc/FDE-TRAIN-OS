/** SHA256 hex — matches backend services/chain/hash_utils.py */

export function normalizeIdNumber(id: string): string {
  return id.trim().replace(/\s/g, "").toUpperCase();
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashIdNumber(idNumber: string): Promise<string> {
  return sha256Hex(normalizeIdNumber(idNumber));
}
