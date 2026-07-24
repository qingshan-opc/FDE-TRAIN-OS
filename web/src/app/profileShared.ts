export const IDENTITY_LABEL: Record<string, string> = {
  unverified: "未认证",
  pending: "审核中",
  verified: "已认证",
  rejected: "未通过",
};

export const IDENTITY_CLASS: Record<string, string> = {
  unverified: "locked",
  pending: "available",
  verified: "passed",
  rejected: "",
};
