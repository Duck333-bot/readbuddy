import { describe, expect, it } from "vitest";
import { isLegacyReadBuddyHost } from "./domainIdentity";

describe("ReadBuddy public domain identity", () => {
  it("recognizes only the legacy Sleepline hostnames for redirect", () => {
    expect(isLegacyReadBuddyHost("sleepline.icu")).toBe(true);
    expect(isLegacyReadBuddyHost("www.sleepline.icu:443")).toBe(true);
    expect(isLegacyReadBuddyHost("readbuddy-fqfwwm4a.manus.space")).toBe(false);
  });
});
