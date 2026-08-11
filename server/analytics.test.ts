import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recordAnalyticsEvent: vi.fn() }));

vi.mock("./db", () => ({
  recordAnalyticsEvent: mocks.recordAnalyticsEvent,
}));

import { analyticsRouter } from "./routers/analytics";

const ctx = {
  user: {
    id: 42,
    openId: "reader-42",
    name: "Reader",
    email: null,
    loginMethod: "manus",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
} as any;

describe("analytics.track", () => {
  beforeEach(() => {
    mocks.recordAnalyticsEvent.mockReset();
    mocks.recordAnalyticsEvent.mockResolvedValue(undefined);
  });

  it("stores interaction metadata without accepting reader text fields", async () => {
    const caller = analyticsRouter.createCaller(ctx);
    await expect(
      caller.track({
        event: "evidence_tap",
        bookId: 9,
        pageNumber: 31,
        metadata: { targetPage: 12 },
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.recordAnalyticsEvent).toHaveBeenCalledWith({
      userId: 42,
      bookId: 9,
      event: "evidence_tap",
      pageNumber: 31,
      metadata: { targetPage: 12 },
    });
  });

  it("rejects unknown event names", async () => {
    const caller = analyticsRouter.createCaller(ctx);
    await expect(caller.track({ event: "raw_book_text" as any })).rejects.toBeDefined();
  });
});
