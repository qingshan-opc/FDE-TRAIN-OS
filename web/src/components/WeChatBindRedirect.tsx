import { useEffect } from "react";
import { wechatBindOauthUrl } from "../lib/wechat";

/** Full-page bounce into WeChat authorize for an already-logged-in unbound account. */
export function WeChatBindRedirect({ next }: { next: string }) {
  useEffect(() => {
    window.location.replace(wechatBindOauthUrl(next || "/app/shop"));
  }, [next]);
  return (
    <div className="app-shell" style={{ padding: "48px 24px", textAlign: "center" }}>
      正在打开微信授权绑定…
    </div>
  );
}
