/** Phone / WeChat mobile UA — iPad is treated as desktop (can learn). */
export function isMobilePhoneUa(ua?: string): boolean {
  const raw = (ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")).trim();
  if (!raw) return false;
  if (/iPad/i.test(raw)) return false;
  if (/iPhone|iPod/i.test(raw)) return true;
  if (/Android/i.test(raw) && /Mobile/i.test(raw)) return true;
  // WeChat on Android tablet sometimes omits Mobile; keep phone-like MicroMessenger + Android
  if (/MicroMessenger/i.test(raw) && /Android/i.test(raw) && !/Tablet|Pad/i.test(raw)) {
    return /Mobile/i.test(raw);
  }
  if (/Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(raw)) return true;
  return false;
}

export const LEARN_DESKTOP_URL = "https://fde.818cloud.com/app/courses";
