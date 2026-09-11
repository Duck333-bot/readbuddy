# Live launch verification — 2026-09-11

The public Vercel deployment is reachable at https://zhiyaai.vercel.app.

## Verified

| Check | Result | Evidence |
|---|---|---|
| Public landing page | Pass | ZhiyaAI landing renders at https://zhiyaai.vercel.app |
| `/healthz` | Pass | HTTP 200 from Vercel; security headers present |
| `/readyz` | Pass | HTTP 200 from Vercel; database readiness is live |
| Google OAuth start | Pass | HTTP 302; redirect URI is `https://zhiyaai.vercel.app/api/auth/google/callback`; secure state cookie is set |
| Unauthenticated Book Brain callback | Pass | HTTP 401; response is private/no-store and does not expose a stack trace |
| Launch PR | Merged | https://github.com/Duck333-bot/readbuddy/pull/1 |

## Still blocked

The browser reached Google account selection and then the password screen for `timothyyou201003@gmail.com`. The agent did not enter or handle the user's password. Therefore authenticated production upload, Reader opening, AI explanation, Stripe authenticated billing checks, and signed Heartbeat execution are not yet verified in this session.

A previous browser attempt produced a Google 400 malformed-request page after account selection; a fresh flow now reaches the password screen, which indicates the server-generated OAuth request and callback are accepted far enough for Google authentication. Interactive completion still requires the user to take over the open browser.

## Deployment

Current focused checkpoint: `aadd4df5` — optional browser cover rendering no longer blocks valid PDF upload. Local typecheck, 205 tests passed with 2 intentional skips, and production build passed before checkpointing.
