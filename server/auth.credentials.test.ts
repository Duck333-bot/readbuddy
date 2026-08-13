import { describe, expect, it } from "vitest";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

describe("production authentication credentials", () => {
  it("accepts the Google OAuth client credentials and Resend delivery key", async () => {
    expect(googleClientId).toBeTruthy();
    expect(googleClientSecret).toBeTruthy();
    expect(resendApiKey).toBeTruthy();
    expect(emailFrom).toBeTruthy();

    // An intentionally unusable code is safe: Google checks the OAuth client
    // first, then returns invalid_grant. A wrong client secret returns
    // invalid_client instead.
    const googleResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId!,
        client_secret: googleClientSecret!,
        code: "readbuddy-credential-validation-code",
        grant_type: "authorization_code",
        redirect_uri: "https://readbuddy-fqfwwm4a.manus.space/api/auth/google/callback",
      }),
    });
    const googlePayload = (await googleResponse.json()) as { error?: string };
    expect(googlePayload.error).toBe("invalid_grant");

    const resendResponse = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });
    expect(resendResponse.ok).toBe(true);
  }, 20_000);
});
