/** Public registration URL for an org or learner invite code (attribution on signup only). */
export function buildOrgRegisterUrl(code: string, origin = window.location.origin): string {
  return `${origin}/login?invite=${encodeURIComponent(code.trim())}`;
}

/** Alias — learner invite uses the same /login?invite= cookie flow. */
export function buildLearnerRegisterUrl(code: string, origin = window.location.origin): string {
  return buildOrgRegisterUrl(code, origin);
}
