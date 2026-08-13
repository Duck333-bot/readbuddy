# Trust Before Growth Sprint Report

## 1. What changed

ReadBuddy now treats **reader trust as a hard system boundary**. Book structure is sourced honestly, entities retain exact page evidence, long books process in small resumable batches, and safe-mode Ask Book answers are now extractive: the answer shows reached source sentences rather than letting a model summarise a famous book from memory. Dune exposed several real defects during testing—front-matter opening pages, unsafe “cited” answers, overlapping Book Brain runs, early-page evidence exclusion, and dark popover contrast—and each was fixed and re-tested against the real book.

## 2. P0 status

| Issue | Status | Reason |
|---|---|---|
| Chapter detection hierarchy and structural honesty | **FIXED** | PDF outline, conservative heading candidates, validation, and explicit synthetic sections return a source and confidence instead of false chapter claims. |
| Synthetic sections impersonating chapters | **FIXED** | Synthetic units are called `Section N`; low-confidence structure suppresses chapter wording. |
| Entity page evidence / `p.unknown` | **FIXED** | Entity pages are deduplicated, safe-filtered, and backed by source-derived mentions. Dune v5 contains page-12 evidence for Paul and Jessica. |
| Source-only safe mode | **FIXED** | The live Dune test found a cited answer that still added unsupported claims. Safe whole-book questions now use reached-page extractive evidence, not a model summary. |
| Citation generation and validation | **FIXED** | Citation pages must be supplied evidence pages; future or unsupported pages are removed server-side. Live Dune answer cited only pp.11–12 from the reached text. |
| Fine-grained retrieval is live | **FIXED** | `retrievalPassages`, rather than only large analysis chunks, are searched; windows that cross a spoiler boundary are clipped to reached pages. |
| Multiple highlight reliability | **FIXED** | Stable page offsets render multiple ranges. On Dune p.13, separate `Paul` and `eyes` highlights persisted and re-rendered after reload. |
| First meaningful page / empty-page recovery | **FIXED** | The Dune front-matter catalogue no longer becomes the opening page; the reader opened to meaningful narrative text. |
| Long-book processing safety | **FIXED** | Book Brain has a lease, bounded batches, staged versions, cooldown pauses, and delayed resume. Dune v5 completed 105 chunks and switched live only when its evidence index completed. |

## 3. P1 status

| Issue | Status | Reason |
|---|---|---|
| Single-word Define / Translate / Explain | **FIXED** | A real one-word Dune selection opened Define, Translate, and Explain. Server verification confirmed concise word and translation paths. |
| Persisted translation language | **FIXED** | First translation records a local target language; later translations reuse it. |
| Short selection silence | **FIXED** | One-character selections are actionable and covered by regression coverage. |
| Mobile parity / Ask Book discovery | **FIXED** | Phone header now shows a named `Ask` entry, plus labelled `I’m lost`; mobile evidence return and selection components remain available. |
| Spoiler override | **FIXED** | Settings show safe versus whole-book options and display a clear warning before removing the boundary. |
| I’m Lost discoverability | **FIXED** | A compact labelled control stays visible without covering body text. |
| Resume timing and direct-page mismatch | **FIXED** | Recaps wait for a meaningful elapsed absence and are suppressed for explicit page URLs, preventing stale-page cards. |
| Night mode | **FIXED** | Reader body, settings popover, spoiler inset, controls, and portal surfaces use coherent dark semantic roles. The live Dune settings panel was checked after the fix. |
| Conservative reflow | **FIXED** | Ordinary short Title Case content remains body text without strong structural proof. |
| Keyboard reading | **FIXED** | Right Arrow advanced live Dune from p.12 to p.13 in discrete mode; Up/Down remain native scroll; continuous mode blocks page jumping. |
| Misleading More control | **FIXED** | Secondary actions are genuine actions; empty “More” behavior is not presented as a feature. |
| Feedback clarity | **FIXED** | Feedback acknowledges the click and offers compact negative categories without a modal. |
| Notebook memory views | **FIXED** | Notebook includes All, Highlights, My notes, and AI explanations, each with source-page return. |

## 4. Files changed

| Area | Exact files |
|---|---|
| PDF / structure / Book Brain | `server/pdf.ts`, `server/bookStructure.ts`, `server/bookBrain.ts`, `server/handlers/bookBrainHandler.ts`, `server/db.ts`, `server/routers/books.ts` |
| Grounding / AI safety | `server/citations.ts`, `server/readingBuddy.ts`, `server/safeAnswerGuard.ts`, `server/routers/buddy.ts`, `server/routers/reader.ts`, `server/readerMemoryVisibility.ts`, `server/llm/router.ts` |
| Reader / mobile / visual trust | `client/src/pages/Reader.tsx`, `client/src/components/reader/ReaderContent.tsx`, `client/src/components/reader/ReaderParagraph.tsx`, `client/src/components/reader/ReaderSettings.tsx`, `client/src/components/reader/SelectionToolbar.tsx`, `client/src/components/reader/InlineAnswerCard.tsx`, `client/src/components/reader/LostButton.tsx`, `client/src/lib/selection.ts`, `client/src/lib/readerResume.ts`, `client/src/index.css` |
| Reader-owned memory | `server/routers/annotations.ts`, `client/src/pages/Notebook.tsx` |
| Schema / migrations | `drizzle/schema.ts`, `drizzle/0012_clean_wong.sql`, `drizzle/0013_salty_vector.sql`, `drizzle/0014_jittery_guardian.sql`, `drizzle/0015_same_weapon_omega.sql`, `drizzle/0016_kind_johnny_blaze.sql`, `drizzle/0017_neat_ikaris.sql` |
| Tests | `server/bookBrain.test.ts`, `server/bookBrainVersion.test.ts`, `server/bookStructure.test.ts`, `server/citations.test.ts`, `server/deepseek.secret.test.ts`, `server/reader.resume.test.ts`, `server/readerMemoryVisibility.test.ts`, `server/safeAnswerGuard.test.ts`, `server/llm/router.test.ts`, `client/src/lib/selection.test.ts`, `client/src/lib/readerResume.test.ts` |

## 5. Schema and migrations

The additive migrations preserve original PDFs and extracted pages while adding outline/meaningful-start fields, structure provenance and confidence, entity page evidence, annotation offsets, per-version derived-data fields, a Book Brain processing lease, staged pipeline state, retry timestamps, and compact paused-provider diagnostics. This makes background recovery and derived-data replacement possible without forcing users to re-upload a book.

## 6. Book Brain version and reprocessing

`BOOK_BRAIN_VERSION` is now **5**. Any completed book below v5 is stale and is rebuilt in the background. The active version remains readable while the new version prepares chunks, synthesis, embeddings, and evidence passages. Only a completed rebuild switches the active version. Dune proved this behavior: v4 remained live while v5 processed 105 staged chunks, then its active analysis switched to v5 after completion. Provider pauses preserve work and wait for a 15-minute cooldown before continuing the same queue.

## 7. Tests

| Check | Result |
|---|---|
| Previous test count | 104 at sprint start |
| Current test count | **133 passing** across 21 test files |
| Typecheck | `pnpm check` passes |
| Production build | Passed before the final extractive safe-answer adjustment; final full regression remains required for release checkpoint |
| Added coverage | Structure honesty, entity page evidence, citation rejection, source-only answer guard, meaningful first page, staged Book Brain leases/cooldowns/versioning, resume route suppression, one-character selection, mobile control behavior, and safe Reader Memory. |

## 8. Manual verification

| Scenario | Result | Evidence / qualification |
|---|---|---|
| A — character-heavy novel | **VERIFIED** | Dune opened on narrative text. Dune v5 stores Paul/Jessica page-12 evidence; safe Ask Book only used pp.11–12 and did not cite future pages. |
| B — 700+ page complex nonfiction | **PARTIALLY VERIFIED** | The available user-authorized fixture is a 1,493-page novel (1,200 extracted pages), not nonfiction. Its long-book mechanics passed: 105-chunk v5 completion, fine-grained retrieval, safe clipping, evidence tap p.12→p.11, back-to-p.12, and two same-paragraph highlights persisted. A complex nonfiction text still needs its own study. |
| C — ESL memoir workflow | **PARTIALLY VERIFIED** | Dune single-word selection visibly opened Define / Translate / Explain, and backend word/translation paths completed. The exact `estrangement` memoir wording was not available locally. |
| D — phone-only student | **VERIFIED** | Narrow phone review shows named `Ask`, labelled `I’m lost`, readable text, compact header, and non-obstructive controls. Evidence jump/back was proven in the real reader; responsive implementation shares that flow. |
| E — night reading | **VERIFIED** | Live Dune night settings, body contrast, and the former bright popover/inset failure were checked. |
| F — 40-second absence | **VERIFIED** | Regression timing test blocks the recap; explicit Dune page URLs also suppress stale recap cards. |
| G — text layout | **VERIFIED** | Dune’s short/title-case and page-boundary content rendered as body text, not decorative fake headings. |

## 9. Remaining known limitations

The last product-specific gap is **coverage breadth**, not a confirmed defect: no legal long complex-nonfiction PDF was available, so Scenario B’s content type was tested through an equally long novel rather than a textbook or philosophy work. The safe whole-book question mode is intentionally more conservative now: it provides exact reached excerpts rather than a polished broad explanation until evidence-grounded summarisation has stronger claim-level validation. That trade-off protects trust. Build still reports a large client-bundle warning from existing syntax-rendering dependencies; it is a performance follow-up, not a reading-trust blocker.

## 10. Recommendation

**NOT READY — MORE TRUST FIXES REQUIRED**

Do not add new features. First run the same B-scenario with a legal long complex-nonfiction book and confirm the conservative safe-answer behavior remains useful rather than merely safe. Then make a readiness decision from that evidence.
