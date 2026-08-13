import { describe, expect, it } from "vitest";
import { isPublicLandingEvent, isPublicVisitorId } from "./publicLanding";

describe("public landing endpoint validation", () => {
  it("accepts only the two privacy-safe public funnel events", () => {
    expect(isPublicLandingEvent("landing_view")).toBe(true);
    expect(isPublicLandingEvent("landing_start_clicked")).toBe(true);
    expect(isPublicLandingEvent("reader_opened")).toBe(false);
  });

  it("accepts a bounded anonymous visitor id without accepting arbitrary payloads", () => {
    expect(isPublicVisitorId("readbuddy-visitor_1234")).toBe(true);
    expect(isPublicVisitorId("short")).toBe(false);
    expect(isPublicVisitorId("visitor id with spaces")).toBe(false);
  });
});
