import { describe, expect, it } from "vitest";
import { isMobilePhoneUa } from "./device";

describe("isMobilePhoneUa", () => {
  it("detects iPhone and Android phones", () => {
    expect(isMobilePhoneUa("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(
      isMobilePhoneUa(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36",
      ),
    ).toBe(true);
  });

  it("does not treat iPad as phone", () => {
    expect(isMobilePhoneUa("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(false);
  });

  it("does not treat desktop Chrome as phone", () => {
    expect(
      isMobilePhoneUa(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});
