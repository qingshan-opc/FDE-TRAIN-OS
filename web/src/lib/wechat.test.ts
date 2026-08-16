import { describe, expect, it } from "vitest";
import { sanitizeAppNext, wechatBindOauthUrl, wechatJsapiOpenidUrl, wechatMpEntryUrl } from "./wechat";

describe("wechat oauth urls", () => {
  it("keeps jsapi payer oauth off the login entry", () => {
    expect(wechatJsapiOpenidUrl("/app/shop")).toBe(
      "/api/v1/auth/wechat/jsapi-openid?next=%2Fapp%2Fshop",
    );
    expect(wechatMpEntryUrl("/app/shop")).toContain("/api/v1/auth/wechat/mp-entry");
    expect(wechatJsapiOpenidUrl("/app/shop")).not.toContain("mp-entry");
  });

  it("keeps bind oauth off the login entry", () => {
    expect(wechatBindOauthUrl("/app/invite")).toBe(
      "/api/v1/auth/wechat/bind-oauth?next=%2Fapp%2Finvite",
    );
    expect(wechatBindOauthUrl("/app/invite")).not.toContain("mp-entry");
  });

  it("rejects absolute next paths", () => {
    expect(sanitizeAppNext("https://evil.example/x", "/app/shop")).toBe("/app/shop");
  });
});
