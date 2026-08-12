# Controlled Five-Reader Alpha

## Product Freeze

For the next five sessions, do **not** redesign the interface, add features, add AI modes, change onboarding, add animations, or move buttons based on internal preference. The only permitted changes are **P0 trust breakers** and **obvious reading blockers**. Every reader must encounter materially the same product.

## Recruit Exactly Five Reading Contexts

Recruit people who read several times a week, currently have a real difficult book, and already use a PDF reader, Kindle, or Apple Books. Aim for one novel reader, one difficult nonfiction reader, one philosophy/history reader, one textbook or academic-material reader, and one reader using English as an additional language.

## Invitation Message

> I’m testing ReadBuddy, a tool that helps people read difficult books with AI. Please bring a PDF of something you are genuinely reading. Upload it and use ReadBuddy exactly as you normally would for 20–30 minutes. I will not give you a tour because I want to see what is naturally clear or confusing. I will only observe and ask a few questions at the end.

## Observer Rules

Do not explain the interface, suggest buttons, rescue confusing moments, or sell the product. Note the timestamp, the exact hesitation, what the reader tried, and whether they self-recovered. The first moment that feels meaningfully better than normal reading is the **magic moment**. The first moment they doubt an answer, evidence, spoiler boundary, or interaction is the **trust-breaking moment**.

## Session Scorecard

| Moment | Observe | Outcome |
|---|---|---|
| Landing, first 10 seconds | Can they explain what ReadBuddy does? | Clear / unclear |
| Upload | Do they know what to upload and that they can start early? | Clear / unclear |
| Library | Is continuing or opening a book obvious? | Yes / no |
| Reader | Do they begin reading naturally? | Yes / no |
| Selection | Do they discover selection and Explain without a tour? | Yes / no |
| AI | Which actions do they naturally need? | Record only actions used |
| Magic | What first made ReadBuddy better than ordinary reading? | Verbatim note |
| Trust | What first weakened trust? | Verbatim note |

## End Questions

1. What annoyed or confused you?
2. What was the most useful thing ReadBuddy did?
3. Was there anything the AI said that you did not trust?
4. What did you expect ReadBuddy to do that it did not?
5. If you read another 30 pages tonight, would you use ReadBuddy or your normal reader? Why?
6. If ReadBuddy disappeared tomorrow, what would you miss?

## Triage After Every Session

| Bucket | Definition | Action |
|---|---|---|
| P0 — Trust breaker | Spoiler, incorrect evidence, wrong answer, lost highlight, failed upload | Fix immediately before the next reader if reproducible |
| P1 — Reading blocker | Explain cannot be discovered, navigation breaks, mobile reading fails, AI is too slow | Fix before the next cohort |
| P2 — Friction | Minor interaction or visual annoyance | Aggregate; fix only if repeated |
| P3 — Feature request | “It would be cool if…” | Record, then ignore until a pattern proves value |

## Decision Dashboard

After each session, check `/alpha` for: acquisition, activation, magic actions, meaningful-reading engagement, same-book returns, negative answer rate, Time to First Useful Moment, and operation failures. Do not choose the next product sprint until all five sessions are complete unless a P0 issue appears.
