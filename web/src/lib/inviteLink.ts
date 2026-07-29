/** Public registration URL for an org invite code (attribution on signup only). */
export function buildOrgRegisterUrl(code: string, origin = window.location.origin): string {
  return `${origin}/login?invite=${encodeURIComponent(code.trim())}`;
}
