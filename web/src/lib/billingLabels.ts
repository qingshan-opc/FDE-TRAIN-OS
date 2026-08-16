export const PROFIT_SHARE_STATE: Record<string, { color: string; label: string }> = {
  held: { color: "warning", label: "7天后到账" },
  pending: { color: "warning", label: "待分账" },
  pending_manual: { color: "warning", label: "待绑定收款微信" },
  submitting: { color: "processing", label: "分账提交中" },
  processing: { color: "processing", label: "分账中" },
  finished: { color: "success", label: "已到账" },
  failed: { color: "error", label: "失败" },
  cancelled: { color: "default", label: "已取消" },
};

export const SHARE_HOLD_DAYS = 7;

export const SHARE_HOLD_COPY = {
  org: {
    message: "佣金 7 天到账",
    description:
      "学员通过本机构邀请链接注册并付费后，默认按 30% 分润；佣金冻结 7 天，满 7 天自动分账到机构绑定的微信。",
  },
  personal: {
    message: "佣金 7 天到账",
    description:
      "好友通过你的邀请链接注册并付费后，按 30% 分润；佣金冻结 7 天，满 7 天自动分账到你绑定的微信。",
  },
} as const;

export function profitShareStateLabel(state: string | null | undefined): string {
  if (!state) return "未发起";
  return PROFIT_SHARE_STATE[state]?.label || state;
}
