import { describe, expect, it, vi } from "vitest";
import { isLegacyReadBuddyHost, redirectLegacyReadBuddyHost } from "./domainIdentity";

describe("ReadBuddy public domain identity", () => {
  it("recognizes only the legacy Sleepline hostnames for redirect", () => {
    expect(isLegacyReadBuddyHost("sleepline.icu")).toBe(true);
    expect(isLegacyReadBuddyHost("www.sleepline.icu:443")).toBe(true);
    expect(isLegacyReadBuddyHost("readbuddy-fqfwwm4a.manus.space")).toBe(false);
  });

  it("prefers the forwarded public host when managed hosting proxies the request", () => {
    const redirect = vi.fn();
    const next = vi.fn();
    redirectLegacyReadBuddyHost(
      { get: (name: string) => name === "x-forwarded-host" ? "sleepline.icu, internal-host" : "internal-host", originalUrl: "/" } as any,
      { redirect } as any,
      next,
    );
    expect(redirect).toHaveBeenCalledWith(308, "https://readbuddy-fqfwwm4a.manus.space/");
    expect(next).not.toHaveBeenCalled();
  });
});
