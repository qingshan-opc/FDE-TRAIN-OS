import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const DISMISS_KEY = "fde_profile_complete_dismissed";

type Props = {
  /** From /auth/me or /me/profile */
  incomplete?: boolean;
  compact?: boolean;
};

export function ProfileCompleteBanner({ incomplete, compact }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!incomplete || dismissed) return null;

  return (
    <div className={`profile-complete-banner${compact ? " profile-complete-banner--compact" : ""}`} role="status">
      <div className="profile-complete-banner__body">
        <strong>完善个人资料</strong>
        <span className="muted">
          当前仍是默认昵称或未设置头像。设置后导航栏与证书展示会更完整（微信授权若未返回头像，可手动上传）。
        </span>
      </div>
      <div className="profile-complete-banner__actions">
        <Link to="/app/profile" className="app-btn app-btn--primary app-btn--sm">
          去完善
        </Link>
        <button
          type="button"
          className="app-btn app-btn--ghost app-btn--sm"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
        >
          稍后
        </button>
      </div>
    </div>
  );
}
