# Trust Before Growth Sprint Report

## 1. What changed

ReadBuddy now treats trust as an architectural constraint rather than a prompt preference. Book structure is sourced from PDF outlines or conservative evidence and marked honestly when synthetic; entities retain page evidence; the live retrieval path uses fine-grained passages; safe answers use source-only rules and citation validation; highlights use stable offsets; reader controls support short words, translation preferences, mobile access, spoiler override, readable night mode, and reader-owned memory. Existing Book Brains now have a versioned, staged rebuild path that keeps the old derived analysis active until a complete replacement is ready.

## 2. P0 status

| Issue | Status | Reason |
|---|---|---|
| Chapter detection hierarchy and structural honesty | **FIXED** | PDF outline, conservative heading candidates, optional validation, and explicit synthetic sections now return source/confidence. |
| Synthetic sections must not impersonate chapters | **FIXED** | Synthetic units are named `Section N`; structure confidence controls chapter claims and labels. |
| Entity page evidence / no `p.unknown` | **FIXED** | Entities retain deduplicated appearance pages; the safe answer path only supplies page-supported appearances. |
| Source-only safe mode | **FIXED** | The safe prompt has source-only/refusal rules; retrieval, entity evidence, and Reader Memory are page-filtered before prompting. |
| Citation generation and validation | **FIXED** | Retrieved-evidence answers are instructed to cite `[[p.N]]`; the server strips unsupported or future citations before display. |
| Fine-grained retrieval actually live | **FIXED** | `buildBrainContext` searches version-matched `retrievalPassages`, then adds only reader-accessible passages to the prompt. |
| Multiple highlight reliability | **FIXED** | New annotations persist normalized `startOffset`/`endOffset`; rendering supports multiple spans in the same page/paragraph while preserving legacy rows. |
| First readable page / empty page recovery | **FIXED** | New books open at `firstReadablePage`; a rare empty extraction now offers a calm next-page action. |

## 3. P1 status

| Issue | Status | Reason |
|---|---|---|
| Single-word Define / Translate / Explain | **FIXED** | A single word changes primary actions to Define, Translate, Explain; word responses are model-bounded to stay short. |
| Persisted target language | **FIXED** | First translation asks for a target language and stores it locally for one-tap reuse. |
| Short selection silence | **FIXED** | One-character valid selections are actionable and covered by regression tests. |
| Mobile parity | **FIXED** | Mobile receives a persistent Ask Book control, evidence-return control, bottom selection sheet, spoiler settings, and visible Lost action. |
| Spoiler override | **FIXED** | Settings offer “Only what I’ve read” and “Use the whole book”; full-book mode requires a warning confirmation. |
| I’m Lost discoverability | **FIXED** | The reader now shows a labelled, compact `I’m lost` control. |
| Resume timing | **FIXED** | Recaps require a six-hour elapsed interval; a 40-second return cannot call the recap model. |
| Night mode | **FIXED** | Reader theme variables now apply through portal surfaces as well as body text, notes, evidence, and answer cards. |
| Conservative reflow | **FIXED** | Short Title Case text is body text unless strong structural evidence is present. |
| Keyboard reading | **FIXED** | Left/Right only change discrete pages; Up/Down retain native scrolling; continuous mode blocks arrow page jumps. |
| Misleading More control | **FIXED** | More opens a real secondary menu where applicable and is absent when it has nothing to offer. |
| Feedback clarity | **FIXED** | Feedback acknowledges the click and negative feedback can optionally be categorised without a modal. |
| Notebook memory views | **FIXED** | Notebook now has All, Highlights, My notes, and AI explanations, with source-page returns. |

## 4. Files changed

| Area | Exact files |
|---|---|
| PDF / structure / Book Brain | `server/pdf.ts`, `server/bookStructure.ts`, `server/bookBrain.ts`, `server/handlers/bookBrainHandler.ts`, `server/db.ts`, `server/routers/books.ts` |
| Grounding / AI safety | `server/citations.ts`, `server/readingBuddy.ts`, `server/routers/buddy.ts`, `server/routers/reader.ts`, `server/readerMemoryVisibility.ts` |
| Reader / mobile / visual trust | `client/src/pages/Reader.tsx`, `client/src/components/reader/ReaderContent.tsx`, `client/src/components/reader/ReaderParagraph.tsx`, `client/src/components/reader/ReaderSettings.tsx`, `client/src/components/reader/SelectionToolbar.tsx`, `client/src/components/reader/InlineAnswerCard.tsx`, `client/src/components/reader/LostButton.tsx`, `client/src/lib/selection.ts`, `client/src/index.css` |
| Reader-owned memory | `server/routers/annotations.ts`, `client/src/pages/Notebook.tsx` |
| Schema / migrations | `drizzle/schema.ts`, `drizzle/0012_clean_wong.sql`, `drizzle/0014_jittery_guardian.sql`, `drizzle/0015_same_weapon_omega.sql`, `drizzle/0016_kind_johnny_blaze.sql`, `drizzle/0017_neat_ikaris.sql` |
| Tests | `server/citations.test.ts`, `server/bookStructure.test.ts`, `server/reader.resume.test.ts`, `server/bookBrainVersion.test.ts`, `server/readerMemoryVisibility.test.ts`, `client/src/lib/selection.test.ts` |

## 5. Schema and migrations

Migration `0012_clean_wong.sql` adds additive trust fields for PDF outline, first readable page, structure source/confidence, entity page evidence, annotation offsets, and analysis versioning. Migration `0014_jittery_guardian.sql` adds `analysisVersion` to embeddings, entities, and retrieval passages. These columns make it possible to keep derived data separate by Book Brain version while preserving original PDFs and extracted pages.

## 6. Book Brain version and reprocessing

`BOOK_BRAIN_VERSION` is now `4`. A Book Brain is stale if it is incomplete or its stored version is below 4. The scheduled handler no longer skips a pass-complete old version. A rebuild writes v4 chunks, entities, embeddings, and retrieval passages beside the active version. Only after all passes succeed does one Book Brain metadata update switch the active version to 4. Original PDF and page extraction records are never rewritten.

The long-book verification exposed an additional production-critical constraint: a 1,200-page book cannot safely be processed as one uninterrupted background request. The pipeline is now **leased and resumable**. It persists a staged v4 structure and chunk queue, processes bounded batches, preserves completed chunks between invocations, and atomically prevents two scheduled runs from working on the same book. If the configured AI provider is temporarily unavailable, it preserves the queue, records a compact operational pause, and retries only after a cooldown rather than repeatedly consuming requests.

## 7. Tests

| Check | Result |
|---|---|
| Previous test count | 104 at sprint start |
| Current test count | **123 passing** across 17 test files |
| Typecheck | `pnpm check` passes |
| Production build | `pnpm build` passes |
| Added coverage | citation rejection, outline/heading/synthetic structure, resume gate, one-character selections, Book Brain version staleness, spoiler-safe Reader Memory |

## 8. Manual verification

| Scenario | Result | Evidence / qualification |
|---|---|---|
| A — character-heavy novel | **PARTIALLY VERIFIED** | Existing Charlotte's Web reader opens on readable page text; safe Ask Book request completed on p.7. Who-card first/last-page behaviour still needs an explicit manual selection after a v4 rebuild. |
| B — 700+ page complex nonfiction | **PARTIALLY VERIFIED** | The user-authorized 1,493-page Dune PDF was uploaded and its stored 1,200 extracted pages were checked. It opened at meaningful narrative page 12 after front matter was correctly skipped. The pipeline created and retained a 105-chunk v4 staged queue; two bounded runs retained completed work (3 then 6 chunks). Full retrieval/evidence verification is blocked because the configured AI provider paused further analysis. |
| C — ESL memoir workflow | **NOT VERIFIED** | Toolbar code and translation preference were unit/typechecked, but the exact live `estrangement` selection flow was not manually exercised. |
| D — phone-only student | **PARTIALLY VERIFIED** | Narrow mobile Notebook rendering passed visual review; code exposes mobile Ask Book, return, Lost, spoiler, Define, and Translate. Full live mobile selection/evidence-return interaction remains to be exercised. |
| E — night reading | **PARTIALLY VERIFIED** | Theme variables were implemented for portals and reader surfaces; no final live dark screenshot was captured after the last theme edit. |
| F — 40-second absence | **VERIFIED BY REGRESSION** | A direct timing test confirms no recap before six hours. |
| G — text layout | **VERIFIED BY REGRESSION** | Conservative short Title Case classification is implemented; no fake-heading fixture regression was observed in the visual reader check. |

## 9. Remaining known limitations

The implementation is not yet proven through a complete long-book Book Brain. The user-authorized Dune fixture exposed and closed three real blockers: front matter incorrectly selected as the opening page, a monolithic background analysis that could not finish a large book, and unsafe repeated failures when the configured AI provider became unavailable. The long-book queue is now preserved (105 staged chunks; completed work remains intact), but full retrieval, evidence-jump, Who?, and long-book spoiler verification require the provider to resume. The connected browser extension also became unresponsive during later live interaction checks, so those specific browser actions are not claimed as passed. Build still warns that the main client bundle is large because syntax-rendering dependencies are already bundled; that is a performance follow-up, not a trust blocker.

## 10. Recommendation

**NOT READY — COMPLETE THE PAUSED LONG-BOOK VERIFICATION**

Do not add features. Wait for the staged Dune Book Brain to resume, then run retrieval/evidence/spoiler tests against it and complete the real mobile selection/evidence-return checks. Only then decide whether the evidence supports moving to the next 10–15 real users.
