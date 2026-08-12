# ReadBuddy Controlled Alpha — Execution Kit

This kit turns the controlled alpha plan into something you can run tonight with no preparation. It contains the exact words to send, the exact words to say, the sheet you fill in while watching, the questions you ask afterwards, the rule for deciding what to fix, and the report you write at the end. Everything here assumes the product is frozen: during the five sessions you change nothing except reproducible trust breakers and reading blockers.

## Before You Start

The build has been verified. Type checking passes, 104 automated tests pass, the production build compiles, and the owner dashboard at `/alpha` now reports the six decisions plus the speed and cost numbers the final report needs. Two things were fixed during verification: the library subtitle no longer claimed "Nothing here yet" while books were still loading, and the dashboard now computes median and p95 answer latency, Book Brain duration, failure rate, and estimated cost per book, per answer, and per reader.

Open `/alpha` once before the first session and note the current numbers. That is your baseline, so anything that moves afterwards came from a real reader.

## Step 1 — Recruit Five Different Reading Situations

You need five people who genuinely read and who currently have a real book in front of them. Someone who only shows up to be nice to you produces polite feedback, which is worse than no feedback.

| Reader | Reading situation | What their session mainly tests |
|---|---|---|
| 1 | Novel with characters and long narrative | Who?, earlier-context recall, spoiler safety |
| 2 | Difficult nonfiction (business, psychology, economics, science) | Explain, Simpler, argument understanding |
| 3 | History or philosophy | Context, earlier connections, concept memory |
| 4 | Academic or textbook material | Dense terminology, Explain quality, chapter debrief |
| 5 | Reads English as an additional language | Vocabulary handling, Simpler, sentence-level clarity |

Send this message and nothing more:

> I'm testing ReadBuddy, a tool for reading difficult books with AI. Bring a PDF of something you are genuinely reading. You'll use it for 20–30 minutes exactly how you normally would. I won't give you a tour, because I need to see what is naturally clear and what isn't. I'll just watch and ask a few questions at the end.

## Step 2 — The Only Thing You Say at the Start

> ReadBuddy helps you read difficult books with AI. Upload something you're genuinely reading and use it however you normally would.

Then stop talking. Do not point at buttons, do not explain highlighting, do not defend the design, and do not answer "what does this do?" with an explanation — reply "what do you think it does?" and write down the answer. Only intervene if the reader is completely stuck and the session would otherwise end.

## Step 3 — The Observation Sheet

Copy this table once per reader and fill it in live. Write what happened, not what you hope happened.

| Stage | What to watch for | Note |
|---|---|---|
| Landing, first 10 seconds | Can they say what ReadBuddy does in their own words? Do they think it is "chat with a PDF"? | |
| Upload | Do they know what to upload? Do they realise they can start reading before processing finishes? | |
| Library | Is continuing or reopening the book obvious? | |
| Reader | Do they actually begin reading, or keep poking at the interface? | |
| Discovery | Do they discover selection and Explain with no instruction? How long did it take? | |
| Features used | Which of Explain, Simpler, Context, Who?, I'm Lost, Ask Book, evidence links, highlights, notes, bookmarks, chapter debrief they used naturally | |
| First magic moment | The first moment reading with ReadBuddy was clearly better than reading alone — which feature, at what time, and what they said | |
| First trust break | The first moment they doubted an answer, evidence, spoiler boundary, speed, or navigation | |
| Hesitations | Every pause, misclick, wrong expectation, and "wait, what?" with a timestamp | |

Do not treat unused features as failure. A feature that stays invisible until needed is behaving correctly. The failure case is a reader who needed something and could not find it.

## Step 4 — The Eight Questions Afterwards

Ask these in order and write answers close to verbatim. Never soften a complaint and never upgrade a mild compliment into evidence of love.

1. What annoyed or confused you?
2. What was the most useful thing ReadBuddy did?
3. Was there anything ReadBuddy said that you didn't trust?
4. What did you expect ReadBuddy to do that it didn't?
5. If you were reading another 30 pages tonight, would you use ReadBuddy or your normal reading app — and why?
6. If ReadBuddy disappeared tomorrow, what would you actually miss?
7. Was anything distracting you from the book itself?
8. Was there anything you wanted to do repeatedly that took too much effort?

Question 5 is the one that matters most. It is the closest thing to a purchase decision that a free session can produce.

## Step 5 — Triage Immediately After Each Session

| Bucket | Definition | Action |
|---|---|---|
| **P0 — Trust breaker** | Spoiler leak, wrong evidence, invented book content, lost highlight or note, failed upload, broken navigation, privacy problem | Fix before the next reader if you can reproduce it |
| **P1 — Reading blocker** | Cannot start reading, cannot discover Explain, repeated AI failure, unusable slowness, broken mobile reading, lost reading position | Fix only if reproducible and severe enough to invalidate later sessions |
| **P2 — Friction** | Minor annoyance or awkward interaction | Record. Do not fix during the study |
| **P3 — Feature request** | "It would be cool if…" | Record. Do not build |

One person's taste in colours is not evidence. Two people failing the same task in the same place is.

After Reader 1 specifically, review the same evening while the session is fresh, fix P0 issues only, and keep everything else consistent so Readers 2 through 5 are still testing the same product.

## Step 6 — Numbers to Copy From `/alpha` After Each Session

| Field | Where |
|---|---|
| Reached a ready-to-read book | Acquisition card |
| Used AI while reading | Activation card |
| Evidence, character, and context moments | Magic card |
| Meaningful reading sessions | Engagement card |
| Same-book returns | Retention card |
| Negative answer rate | Trust card |
| Time to first useful moment | Speed, cost and trust card |
| Median and p95 answer latency, Book Brain duration, failure rate | Performance and economics panel |
| Cost per book, per answer, per reader | Performance and economics panel |

## Step 7 — The Findings Report

After all five sessions, write one report with these sections and nothing extra.

**A. Executive conclusion.** Two honest answers: is there evidence ReadBuddy solves a real reading problem, and are readers willing to keep reading inside ReadBuddy instead of their normal app? Five people cannot prove product-market fit, so write what five people showed, not what you hope a thousand would show.

**B. Usage patterns.** For Explain, Simpler, Context, Who?, I'm Lost, Ask Book, evidence, highlights, notes, bookmarks, resume recap, chapter debrief, and Reader Intelligence, record how many of the five discovered it, used it, used it more than once, reacted positively, and reacted negatively.

**C. Magic moments.** Rank the moments that created obvious value, using observed behaviour only.

**D. Trust failures.** Rank every trust problem by severity and frequency. Any spoiler leak is automatically the top item.

**E. Usability problems.** Rank repeated observed problems, not design opinions.

**F. Retention signals.** Who returned, to which book, how soon, what they used on return, whether the resume recap helped, and how long meaningful sessions lasted.

**G. Performance and economics.** Median and p95 answer latency, Book Brain processing time, failure rate, and estimated cost per book, per answer, and per reader.

## Step 8 — Choose Exactly One Next Sprint

| Evidence pattern | Next sprint |
|---|---|
| Readers value the intelligence but fight the product | **Usability.** No new features. Fix discovery, navigation, speed, and mobile reading |
| Product works but feels cheap or untrustworthy to readers | **Premium polish.** Only if readers actually reacted to perceived quality |
| Product is usable and polished but readers have no recurring reason to return | **One** high-frequency feature that the evidence names |

Priority order unless the study clearly says otherwise: practical usefulness and usability first, answer quality and trust second, visual polish third, new features last. A faster, more trustworthy Explain is worth more than ten new tools.

The success criterion is not that readers think ReadBuddy is clever. It is that a reader continuing tonight would rather open ReadBuddy than their normal reader.
