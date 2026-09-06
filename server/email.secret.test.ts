import { describe, expect, it } from "vitest";

describe.runIf(process.env.RUN_LIVE_TESTS === "true")("Resend launch credentials", () => {
  it("uses a verified sender domain for passwordless authentication", async () => {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    expect(key).toBeTruthy();
    expect(from).toBeTruthy();
    const address = from!.match(/<([^>]+)>/)?.[1] ?? from!;
    const domain = address.split("@")[1]?.trim().toLowerCase();
    expect(domain).toBeTruthy();
    expect(domain).not.toBe("resend.dev");
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.ok).toBe(true);
    const payload = await response.json() as { data?: Array<{ name: string; status: string }> };
    const sender = payload.data?.find(item => item.name.toLowerCase() === domain);
    expect(sender?.status).toBe("verified");
  }, 15_000);
});
