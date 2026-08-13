# ReadBuddy Premium Conversion & Desirability Sprint

## Executive conclusion

This sprint moved ReadBuddy from a **good-looking AI reading utility** toward a product that communicates a clearer reason to exist: it remembers the book around the reader, then brings back only the earlier evidence that helps at the moment of confusion. The redesign does not add a new feature category. It makes the existing Book Brain, evidence, spoiler protection, and reader memory more legible before a person uploads a book.

The result is appropriate for a **small desirability study**, alongside the already planned long nonfiction trust verification. It is not a reason to broaden the product or begin paid conversion work. The next question is whether readers naturally understand the promise, want to upload a real book, and consider the evidence-linked reading moment worth returning for.

| Decision | Status | Why |
|---|---|---|
| Run a five-reader desirability study | **Yes** | The product now has a concrete value story and a focused first-use path. |
| Add more AI modes or social features | **No** | The evidence chain and reading loop must prove their value first. |
| Introduce paid plans | **Not yet** | There is no repeated willingness-to-pay evidence yet. |
| Keep trust verification active | **Yes** | Long-fiction was tested; a legal long nonfiction fixture remains the most useful final confidence check. |

## Before and after

Before this sprint, the product’s reader was more mature than its conversion story. A new visitor could see a stylish reading product, but not immediately understand why ReadBuddy is different from a PDF app plus a general chatbot. The new landing page starts with the central, concrete moment: a passage is confusing, a remembered earlier page clarifies it, and the reader can inspect the evidence.

| Surface | Before | After |
|---|---|---|
| Landing page | Attractive product language with broad claims | A remembered-margin demonstration, four real reading moments, and one clear “bring a book” path |
| Library | Personal shelf | “Reading room” framing with a strong continuation card for the exact book and page left open |
| Upload | Functional background processing | A calmer first-meeting ritual that explains immediate reading versus quiet background understanding |
| Login | Technically working account entry | Premium, private reading-space framing paired with real Google sign-in |
| Reader | Trustworthy AI cards with some generic assistant visual language | Reader-first hierarchy remains intact; the sprint avoids adding chat-first chrome |

## Trust work completed before visual work

The sprint did not treat appearance as a substitute for reliability. Three pre-design risks were checked first. Mixed clipped and embedded evidence candidates now rank on comparable signals in safe retrieval. Safe Ask Book now allows bounded grounded synthesis rather than forcing a purely extractive response when the evidence supports a concise explanation. Conservative heading handling remained in place for uncertain all-caps PDF text.

These changes preserve the product principle that **spoiler protection constrains retrieval before generation**. They do not depend on a final prompt merely asking a model not to spoil a book.

## Design system direction

The interface uses an original **remembered margin** direction. It combines warm paper, deep ink-blue reading spaces, one violet evidence color, and a small “thread” gesture that links a current line to an earlier page. The goal is not to look like a fantasy library or a generic SaaS dashboard. It is to make the reading relationship visible.

| Element | Rule |
|---|---|
| Color | Warm paper is the default field; deep ink-blue contains immersive reading and continuation moments; violet marks evidence and intelligence. |
| Type | Display serif for book-scale ideas; reading serif for passages; compact sans-serif for controls and provenance. |
| Motion | Small opacity/translation transitions only. No looping attention animations in the reader. |
| Evidence | Page links are visible, named, and revisit-able. No unexplained AI confidence signals. |
| Mobile | The page remains primary; **Ask** and **I’m lost** stay visible and named. |

## Desirability study kit

Run each session with a reader and a real book they care about. Do not teach the interface. Use this opening only:

> “ReadBuddy helps you read difficult books with AI. Upload something you’re genuinely reading and use it however you normally would.”

Observe the first moment they understand the promise, the first time they hesitate, whether they reach for the reading tool naturally, and whether evidence makes the answer feel more trustworthy. Record the reader’s words exactly after the session.

| Question | What it reveals |
|---|---|
| What did you think ReadBuddy was for before you clicked anything? | Conversion clarity |
| What felt different from asking a normal AI chatbot? | Differentiation |
| Which moment, if any, made you want to keep using it? | Desirability / magic moment |
| Did the evidence links make you more or less trusting? | Trust chain quality |
| Did any part feel distracting, unclear, or like extra work? | Reading-first integrity |
| Would you upload your next real book here? Why or why not? | Intent and retention signal |

## Recommended next moves

First, conduct five desirability sessions across a novel reader, difficult nonfiction reader, history/philosophy reader, academic reader, and ESL reader. Second, complete the remaining long nonfiction Book Brain verification. Third, make only P0/P1 changes between readers. Do not create pricing plans, streaks, social features, flashcards, or new AI modes until the reading loop produces repeated evidence of value.
