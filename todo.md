# ReadBuddy TODO

## Foundation
- [x] Design system: serif/sans typography pairing, warm paper palette, tokens in index.css
- [x] Database schema: books, bookPages, notebookEntries tables
- [x] Migration generated with drizzle-kit and applied via webdev_execute_sql
- [x] Install pdfjs-dist for server-side text extraction and client-side cover rendering
- [x] Backend routers: books (list/get/page/upload/progress/rename/remove/search), buddy.ask, notebook CRUD
- [x] Server PDF module: page text extraction, metadata title/author, filename fallback

## Auth & Library
- [x] Login via Manus OAuth from landing page, logout from app header
- [x] Landing page for logged-out visitors (hero, feature explanation, CTA)
- [x] Library dashboard lists only the signed-in user's books
- [x] Each library card shows title, cover thumbnail, page count, reading progress %
- [x] Empty-state UI in library when user has no books
- [x] Delete a book from the library (with confirmation)
- [x] Continue-reading shortcut card at the top of the library

## Upload & Extraction
- [x] Upload dialog accepting a PDF file (drag-and-drop + file picker)
- [x] PDF bytes stored in S3 via storagePut, key saved in DB
- [x] Cover thumbnail rendered from page 1 and stored in S3
- [x] Per-page text extracted and saved to bookPages table
- [x] Title auto-detected from PDF metadata or filename, user can edit it
- [x] Upload progress + error states surfaced in UI
- [x] Reject scanned/image-only PDFs with a clear message

## Reader
- [x] Distraction-free reader view at /read/:bookId showing one page of text
- [x] Next/previous page navigation plus keyboard arrows
- [x] Jump-to-page control and page indicator
- [x] Reading progress (last page read) persisted per user per book
- [x] Font size / reading width controls
- [x] Deep link ?page=N from notebook opens the right page

## Gap fixes
- [x] Inline error state with retry inside the buddy panel (not just a toast)
- [x] PDF metadata title used when the reader does not edit the title field

## AI Reading Buddy
- [x] Selecting text in the reader shows a floating action popover
- [x] AI panel opens with the selected sentence in context
- [x] Modes: Explain, Simplify, Translate, Define
- [x] AI receives surrounding page context for better answers
- [x] Follow-up questions in the same conversation thread
- [x] Loading and error states in the AI panel

## Notebook
- [x] Save any AI answer + its highlighted sentence to the notebook
- [x] Notebook page lists saved entries grouped by book, newest first
- [x] Notebook entries persist across sessions per user
- [x] Jump from a notebook entry back to its page in the reader
- [x] Delete a notebook entry
- [x] Search and per-book filter in the notebook

## Quality
- [x] Vitest coverage for book CRUD (upload/rename/delete/search), progress updates, notebook CRUD, ownership isolation (32 tests)
- [x] Responsive layout verified for landing, library and notebook at desktop and mobile widths
- [x] Screenshot review of landing, library, notebook
- [x] End-to-end smoke script verifying extraction, S3 upload, DB write and a real AI answer
- [x] Production build (`pnpm build`) succeeds
- [x] Fixed mysql2 insertId tuple bug found by the smoke script
- [x] Cascade foreign keys added so deleting a book/user removes pages and notes automatically
- [x] Smoke script re-run end-to-end with no manual SQL cleanup required
- [x] Reader and buddy panel need a real uploaded book to verify visually (requires signed-in session)

## Verification round 2 (scripted UI check)
- [x] Fix selection detection: text-node-safe containment check (selection was never registering)
- [x] Guard arrow-key page turns while extending a selection with shift
- [x] Make the native selection highlight visible (was `selection:bg-transparent`)
- [x] Move the ask pill into the margin beside the selection so it never covers text
- [x] Extract selection logic into `client/src/lib/selection.ts` with 14 unit tests
- [x] Add `scripts/ui-check.mjs`: real drag selection -> pill -> live AI answer -> save -> notebook -> deep link
- [x] Confirmed in a real browser: selection, pill, live AI answer (~1.5k chars), saved note, notebook deep link
- [x] Confirmed `auth.devLogin` is gated behind `NODE_ENV === "development"` (404 in production)
- [x] Removed the seeded preview books, pages and notes from the database
- [x] Removed scratch scripts from the project root

## Book Brain Upgrade (v2)
- [x] Read heartbeat/periodic-updates skill and design background job architecture
- [x] Extend DB schema: bookBrain, bookEntities, readerMemory, readerSettings tables + migration
- [x] Build 4-pass Book Brain pipeline (pass 2: structure, pass 3: entities, pass 4: deep reading)
- [x] Wire Heartbeat job at upload: fires every minute, idempotent, updates passCompleted
- [x] Mount /api/scheduled/bookBrain handler in server/_core/index.ts
- [x] Add getBrain, getSpoilerMode, setSpoilerMode procedures to books router
- [x] Upgrade buddy router: inject Book Brain context + reader memory into every ask call
- [x] Add new buddy modes: context, why (alongside existing explain, simplify, translate, define, ask)
- [x] Update notebookEntries mode enum to include context and why
- [x] Rewrite BuddyPanel: 4 primary buttons (Explain/Simpler/Context/Why important), secondary row (Translate/Define), spoiler-mode toggle, Book Brain status badge, "Even simpler" follow-up
- [x] Reader memory: track vocab/concepts asked, infer preferred explanation level
- [x] Update all vitest mocks to cover new DB helpers and modes — 48/48 tests pass
- [x] Production build passes cleanly


## CRITICAL FIX: Book Brain v3 — Process 100% of Every Book

### Phase 1: Hierarchical Processing (chunk → chapter → whole book)
- [x] Identify chapter boundaries in bookPages (heuristic: page text starts with "Chapter", "CHAPTER", or numbered sections)
- [x] Rewrite buildFullText() to chunk by chapter (not 60k char limit)
- [x] Add chunkAnalysis pass: for each chunk (5–10 pages), generate summary + entities + concepts + important passages
- [x] Add chapterSynthesis pass: combine all chunk analyses for each chapter into a chapter-level brain
- [x] Add wholeBookSynthesis pass: combine all chapter brains into the final book brain
- [x] Update passCompleted enum to track: 1=extraction, 2=chunks, 3=chapters, 4=whole-book, 5=embeddings

### Phase 2: Semantic Retrieval via Embeddings
- [x] Add bookEmbeddings table: (id, bookId, chunkId, embedding, metadata)
- [x] Generate embeddings for every chunk using Manus Forge embedding API
- [x] Implement semantic search: highlight → embed → search all chunks → rerank → return top 5
- [x] Update buildBrainContext() to use semantic search instead of page-proximity heuristic
- [x] Test: "remind me what the author said 180 pages ago" returns relevant passages

### Phase 3: Spoiler-Aware Retrieval
- [x] Filter retrieved chunks by reader's current page before sending to AI
- [x] Store chunk page ranges in bookEmbeddings metadata
- [x] In buildBrainContext(), exclude chunks that occur after reader's current page when spoilerMode="safe"

### Phase 4: LLM Provider Abstraction
- [x] Create server/llm/provider.ts: abstract interface for LLM calls
- [x] Create server/llm/openai.ts: OpenAI-compatible wrapper (current Forge endpoint)
- [x] Create server/llm/deepseek.ts: DeepSeek API wrapper (use DEEPSEEK_API_KEY env var)
- [x] Create server/llm/router.ts: task-based routing (chunk analysis → DeepSeek, whole-book → stronger model, etc.)
- [x] Update invokeLLM() to use the router instead of hardcoded OpenAI
- [x] Update bookBrain.ts to use the new provider abstraction

### Phase 5: Testing & Verification
- [x] End-to-end test: upload a 300+ page book, verify all chunks are processed
- [x] Verify embeddings are generated for every chunk
- [x] Test semantic retrieval: query should find relevant passages from anywhere in the book
- [x] Test spoiler mode: retrieval should exclude future chapters
- [x] Update vitest mocks for new DB helpers (bookEmbeddings, chunkAnalysis, etc.)
- [x] Production build passes cleanly

## P0 Correctness Fixes (from audit)

- [x] P0-1: Wire semanticChunks into live AI prompt in readingBuddy.ts
- [x] P0-1: Remove duplicated BrainContext type; import from bookBrain.ts
- [x] P0-2: Fix spoiler filter: use endPage <= currentPage (not startPage)
- [x] P0-2: Strip whole-book overallSummary/themes from safe-mode context
- [x] P0-2: Strip whole-book entity descriptions from safe-mode context (only include entities first mentioned before currentPage)
- [x] P0-2: Strip current-chapter summary from safe-mode if chapter started after currentPage
- [x] P0-3: Migrate live reading buddy from invokeLLM to llmCall("reading_buddy", ...)
- [x] P0-4: Add server/llm/embeddings.ts with OPENAI_API_KEY direct support + embedding metadata (model, provider, dimensions)
- [x] P0-4: Store embeddingModel/embeddingProvider/dimensions in bookEmbeddings metadata
- [x] P0-5: Embed richer text: chapter title + chunk summary + entities + concepts + original chunk text
- [x] P0-5: Return actual evidence passages (original text) in semanticChunks, not just summaries
- [x] P0-5: Include page citation in evidence: [p.47] "exact passage text"

## Reader Experience Redesign + Core Features

### Reader Memory Fixes
- [x] Fix pageFirstAsked: pass actual pageNumber when storing vocab/concepts
- [x] Fix simplerCount: increment when user uses simplify/even-simpler mode
- [x] Fill knownConcepts: extract and store concepts from explain/context/why answers

### Who Was This Again?
- [x] Add "who" mode to BUDDY_MODES in readingBuddy.ts
- [x] Add character card prompt: name, description, first/last seen page, relationships
- [x] Add tRPC procedure for who-was-this (uses entity data from bookBrain)
- [x] Build inline CharacterCard component: compact, near-text, no sidebar (uses InlineAnswerCard with who mode)
- [x] Wire into selection popover: show "Who is this?" when highlight is 1-3 words

### Reader UX Redesign
- [x] Remove layout shift: AI overlay/drawer instead of fixed 24rem sidebar
- [x] Instant action buttons on selection: Explain · Simpler · Context · More (no intermediate pill)
- [x] Compact inline answer card attached near the passage (not full sidebar)
- [x] Only expand to full panel for follow-ups and deep analysis
- [x] Minimal chrome: fade header/footer while reading, show on mouse move/tap (minimal header implemented; auto-fade is a future enhancement)
- [x] Remove "Brain ready" / "Building pass 3/4" technical language from UI
- [x] Move spoiler settings to reading settings (⚙️ icon), default to "No spoilers"
- [x] Simplify reader header: just ← title ···, no duplicate title/author/progress

### I'm Lost
- [x] Add "I'm lost" button (subtle, always visible in reader)
- [x] Add tRPC procedure: lost() — uses last 5 pages + current chapter + reader history
- [x] Build LostCard component: "Here's what you need to know before continuing"
- [x] No highlight required — triggered by button tap

### Resume Recap
- [x] Detect returning reader (last session > 1 hour ago)
- [x] Show "Welcome back" card with last page and 20-second recap
- [x] Add tRPC procedure: getResumeSummary() — uses last page + chapter + recent events
- [x] Build ResumeCard component: dismissable, shown on library → reader navigation

## Audit Round 3 — Foundation Upgrades

### P0: Safe-mode chapter context leak
- [x] Fix buildBrainContext: do NOT send full chapter summary in safe mode — only use completed chunks (endPage <= currentPage)
- [x] Synthesize a temporary "chapter so far" summary from completed chunks instead of using stored chapter summary
- [x] Only use stored chapter summary once reader reaches chapter end page

### P0: Entity data — make pages/relationships real
- [x] Update Pass 1 chunk extraction to return: name, type, page, roleAtThisPoint, relationshipsSeenHere per entity
- [x] Aggregate entity appearances across chunks: build firstPage, lastPage, allPages[], allRelationships[]
- [x] Update bookEntities schema to store firstPage, lastPage, allPages (JSON), allRelationships (JSON)
- [x] Update Who? prompt to use real firstPage/lastPage/relationships from entity data

### P1: Better chapter detection + token-based chunking
- [x] Check PDF TOC/outline metadata first (pdfjs getOutline)
- [x] Inspect first several lines of each page for heading patterns (not just first line)
- [x] Detect heading patterns: ALL CAPS, "Chapter N", "Part N", numbered headings, etc.
- [x] Switch from fixed 8-page chunks to token-based chunks (~3,000 tokens per chunk)
- [x] Always respect chapter boundaries when chunking
- [x] Fallback to synthetic sections when no structure detected

### P1: Smaller retrieval passages covering 100% of text
- [x] Add retrievalPassages table: ~800-token passages, each with its own embedding
- [x] Generate retrieval passages from every page (sliding window, no gaps)
- [x] Each passage gets its own embedding vector
- [x] Update buildBrainContext to retrieve from passages, not chunks
- [x] Spoiler filter applies to passages too (endPage <= currentPage)

### P2: Chapter debrief
- [x] Add tRPC procedure: chapterDebrief(bookId, chapterIndex) using stored chapter summary
- [x] Build ChapterDebriefCard: main idea, 3 things to remember, key people/concepts, connection to earlier chapters
- [x] Show naturally after finishing a chapter (detect page = chapter end page)
- [x] Add "Discuss chapter" follow-up button

### P2: Chunk concurrency + retry state
- [x] Add status, attemptCount, lastError, processedAt, analysisVersion columns to bookChunks table
- [x] Implement 3-worker concurrent pipeline (Promise.all with concurrency limit)
- [x] Add per-chunk retry logic (max 3 attempts, exponential backoff)
- [x] Update heartbeat handler to process failed/pending chunks

### P3: UX polish
- [x] Anchor answer card after selected paragraph (not after all page text)
- [x] Show Who? only for known entities (check entity index before showing button)
- [x] Make evidence page citations tappable: "p.47 · View passage" → jumps to that page
- [x] Add "Back" action after jumping to evidence passage

## Product Audit Execution — Evidence, Reader Surface, Analytics, and Command Sheet

- [x] Verify GitHub main points to the 83-test Audit Round 3 checkpoint before new work
- [x] Verify `OPENAI_API_KEY` and real `text-embedding-3-small` vectors (1536 dimensions) activate successfully
- [x] Add `[[p.N]]` citation format to reading buddy answers and parse it in the reader
- [x] Render tappable evidence links and provide a return-to-reading-position action after page jumps
- [x] Improve extracted text rendering: headings, subheadings, quotations, bold, and italics
- [x] Add reader-only light, sepia, and dark themes plus text size, line spacing, width, and continuous-reading controls
- [x] Add a privacy-minimal `analyticsEvents` table and track interaction metadata only — never selected passages, questions, or answers
- [x] Track highlight actions, Explain→Simpler, evidence taps, I’m Lost, saves, chapter-debrief opens/dismisses, and whole-book question usage
- [x] Add spoiler-aware `buddy.askBook` retrieval using the reader question itself as the retrieval query
- [x] Add discoverable “Ask this book” command sheet with ⌘K/Ctrl+K and example prompts
- [x] Run typecheck, full Vitest suite, and production build after all changes

## Private Alpha Readiness — Product Priority Reset

- [x] Persistent text highlights that remain visible when the reader returns, without requiring an AI question
- [x] Personal annotations that are distinct from saved AI answers and attach to a selected passage
- [x] One-click current-position bookmarks with a simple return path
- [x] Compact table of contents with chapter jumps, current-chapter state, and bookmark return paths
- [x] Reader Intelligence v1: recognize repeated vocabulary and concepts with a “You’ve seen this before” moment
- [x] Reader Intelligence v1: adapt the default explanation level from repeated Simplify behavior
- [x] Reader Intelligence v1: use known concepts as explicit analogies in explanations
- [x] Small private analytics dashboard for real retention, reading, and AI usage signals; quality/cost remain explicitly uninstrumented rather than estimated
- [x] AI quality benchmark foundation covering groundedness, usefulness, concision, retrieval, and spoiler safety
- [x] Private Alpha readiness checklist for inviting 20–30 active readers

## Reader Design v1 — Feature Freeze and Premium Reading Sprint

- [x] Capture current desktop and mobile reader reference screenshots before visual changes
- [x] Preserve selection, Explain, Simpler, Context, Who?, I’m Lost, Ask this book, citations, jump/back, highlights, notes, bookmarks, contents, recap, debrief, spoiler safety, memory, progress, and analytics
- [x] Refactor `Reader.tsx` into focused components under `client/src/components/reader/` without changing backend intelligence contracts
- [x] Define deliberate paper, sepia, and night reader tokens plus book-first typography hierarchy and restrained lavender evidence/action accent
- [x] Rebuild desktop reading surface with a 620–720px book column, edge-to-edge background, and generous calm whitespace
- [x] Implement low-chrome reader controls that fade while reading and return on mouse/touch/keyboard interaction
- [x] Redesign selection toolbar: Explain, Simpler, Context, conditional Who?, and a compact overflow for highlight, note, define, translate, and ask
- [x] Redesign inline AI annotation card without chat UI patterns; preserve evidence citations and in-place Simpler/More detail actions
- [x] Refine evidence jump/back with temporary passage emphasis and exact reading-position return
- [x] Rebuild Contents as a left drawer with chapter progress and bookmarks
- [x] Redesign settings as one clean appearance/text popover with excellent defaults
- [x] Refine resume recap, I’m Lost, and chapter-end debrief as reader-controlled, compact moments
- [x] Add restrained Framer Motion transitions and reduced-motion support
- [x] Build a touch-first phone design with selection actions and AI help in bottom sheets
- [x] Verify keyboard navigation, focus visibility, contrast, touch targets, responsive zoom resilience, and dark-theme readability
- [x] Add reader UI interaction tests and retain all existing regression tests

## ReadBuddy Design v1 — Dreamy Intellectual Product Experience

- [x] Freeze net-new product features during this visual-product sprint
- [x] Establish a unified visual system: warm cream, midnight navy, soft lavender, celestial blue, muted coral, and rare gold highlights
- [x] Define distinct experience modes: expressive, magical product surfaces outside the reader; calm, book-first reading surface inside
- [x] Redesign the landing page around the promise “Read difficult books with an AI that has already read the whole book”
- [x] Add a scroll-storytelling Book → Chapters → Characters → Concepts → Reader memory journey without technical jargon
- [x] Add original dreamy illustration assets: floating books, constellations, reader memory, and idea connections
- [x] Redesign the library as a personal bookshelf with a featured continue-reading moment, premium covers, and warm hover motion
- [x] Redesign upload and Book Brain processing as a reassuring “I’m reading your book…” progressive experience
- [x] Ensure the reader remains calm: no permanent sidebar, no permanent large toolbar, and motion only when it supports reading
- [x] Add a subtle reader-intelligence margin cue for recognised concepts with an earlier-passage jump path
- [x] Apply consistent, restrained motion to landing, library, upload, and reader interactions with reduced-motion support
- [x] Verify desktop, tablet, and mobile Design v1 consistency plus existing feature regression coverage

## Living Library Visual Identity & Product Shell v2 — Design Only

- [x] Freeze all production UI and feature changes until the visual direction is approved
- [x] Audit current visual-token drift, component-library leakage, and GitHub main sync status
- [x] Define final semantic color roles: Ink, Paper, Night, Violet, Sky, Sun, Coral, Mint, plus background/surface/text/AI/evidence/highlight/success/danger mappings
- [x] Define final typography scales, three type roles, spacing scale, shape rules, shadow rules, and 4-motion system (Reveal, Lift, Thread, Focus)
- [x] Design the proprietary Living Library thread/constellation motif and original ReadBuddy symbol/icon language
- [x] Create high-fidelity desktop and mobile Landing mockups with story-led whole-book intelligence demonstration
- [x] Create high-fidelity desktop and mobile Library mockups with a living reading-history world rather than a database grid
- [x] Create high-fidelity desktop and mobile full-screen Upload / “Read the Book” mockups
- [x] Create high-fidelity desktop and mobile Reader mockups with silent reading and a distinctive margin-thread evidence interaction
- [x] Create a visual acceptance checklist and implementation order; request approval before production changes

## Living Library v2 — Product-Led Revision, Design Only

- [x] Keep production UI and feature work frozen until Living Library v2 passes approval
- [x] Reduce decorative fantasy/constellation language by roughly 40%; remove stars, floating books, gradients, and illustration when they do not explain a connection
- [x] Define the ReadBuddy Thread as the single proprietary visual behavior across landing, upload, library, and reader
- [x] Revise color, type, spacing, shape, and motion for modern editorial confidence: fewer cards, fewer borders, less rounding, stronger hierarchy, more asymmetry
- [x] Redesign landing concept so real reading interaction and spoiler-safe whole-book value are obvious in the first three seconds
- [x] Redesign library concept as a gallery-like private intellectual collection with six or fewer generous book objects
- [x] Redesign upload concept as a full-screen intelligence-forming state with Chapters, Characters, Concepts, Connections, and spoiler-boundary readiness
- [x] Redesign reader concept as silent editorial reading with the ReadBuddy Thread as the only signature behavior
- [x] Create high-fidelity desktop and mobile interaction states: open book, upload processing, highlight, Explain, evidence jump/back, Who?, I’m Lost, resume tomorrow
- [x] Package a strict Living Library v2 approval scorecard; do not implement before every gate passes

## Living Library v2.1 — Approved Production Build

- [x] Update all visual-direction documents: replace broad constellation language with “Every book is full of connections. ReadBuddy remembers the ones that matter.”
- [x] Document and implement two upload readiness moments: early “Your book is ready / Start reading” and later non-blocking “I know this book now” completion
- [x] Preserve background Book Brain processing after early reader entry; never block reading on full analysis completion
- [x] Replace global visual drift with semantic Living Library tokens, finite typography, spacing, shape, shadow, and motion rules
- [x] Implement the ReadBuddy Thread primitive consistently across landing, upload, library, and reader only when a genuine relationship exists
- [x] Implement the approved navigation shell, gallery-like library, and current-journey hierarchy
- [x] Implement the full-screen non-blocking Book Brain upload journey and its in-reader background-processing continuation
- [x] Implement the product-led landing and silent-reader treatment without changing the existing reading-intelligence contracts
- [x] Complete mobile, reduced-motion, keyboard, focus, contrast, and touch-target refinement across the new visual system
- [x] Verify the V2.1 acceptance test: upload → early Start reading → ongoing Book Brain → subtle ready notice, without an interruption

## Alpha Experience Integrity — No New Features

- [x] Audit and purge raw component colors across Upload, Library, Landing, Notebook, Analytics, reader auxiliaries, and empty/error/loading states
- [x] Verify and update all public positioning copy so it states whole-book understanding, reader memory, and spoiler-safe explanations
- [x] Verify current-journey library hierarchy, 3–4 desktop cover columns, and non-SaaS empty/loading states
- [x] Instrument first-reading funnel events: landing, start click, auth, library, upload open, PDF select, upload start, ready, start reading, reader open, meaningful session, highlight, answer, evidence, continued reading, return
- [x] Add owner-only funnel conversion metrics (entered, completed, percent) without collecting book text or question content
- [x] Add first-session event coverage and regression tests for the non-blocking upload/readiness path
- [x] Run desktop/mobile visual regression and create five-reader task script, observation scorecard, and post-session questions
- [x] Publish the Alpha Experience Integrity checkpoint and prepare the five-reader invite packet

## Final Visual and Interaction Quality Audit — No New Features

- [x] Map the provided world-class design criteria to Landing, Library, Upload, Reader, selection, answer, evidence, Who, Lost, and resume states
- [x] Capture post-load desktop and mobile references for Landing, Library, Upload, and Reader; run the hidden-logo consistency test
- [x] Remove any remaining generic dashboard, card-grid, Shadcn, or generic-modal visual cues discovered in the reference audit
- [x] Verify typography hierarchy, whitespace, semantic color composition, Thread restraint, motion purpose, and silent-reader discipline on every primary screen
- [x] Verify non-blocking upload and every protected reading interaction remains functionally intact after refinements
- [x] Run final typecheck, tests, production build, and visual acceptance before release checkpoint

## Controlled Five-Reader Alpha — Instrumentation First, UI Frozen

- [x] Freeze all UI, feature, animation, onboarding, and button-position changes for the five-reader study except P0 broken/confusing blockers
- [x] Add privacy-safe operation telemetry: success/failure, duration, provider, model, token counts, and cost estimates—never raw book text, selected text, questions, or answers
- [x] Instrument upload selected/start/success/failure, text-ready duration, and total Book Brain completion duration
- [x] Instrument Explain, Simpler, Context, Who, I’m Lost, Ask Book, retrieval, embeddings, and Book Brain chunk retries/failures
- [x] Track Time to First Useful Moment from PDF selected to first successful AI explanation
- [x] Add answer-level trust feedback and calculate negatively rated answer rate
- [x] Calculate true same-book return retention and meaningful-reading engagement duration
- [x] Rework `/alpha` into six decision-grade sections: acquisition, activation, magic, engagement, retention, and trust
- [x] Finalize the five-reader study script, observer scorecard, post-session questions, issue-classification sheet, and invitation message
- [x] Add observability regression tests and verify controlled-alpha production build

## Alpha Execution Verification (execution prompt Steps 1–2)

- [x] Step 1: confirm build/tests pass and every listed reader feature plus telemetry stream is functional
- [x] Step 2: confirm /alpha answers acquisition, activation, magic, engagement, retention, and trust
- [x] Add performance/economics aggregation for findings report section G (median/p95 latency, Book Brain time, failure rate, cost per book/interaction/reader) with vitest coverage
- [x] Produce session-ready execution kit: recruitment brief, observation sheet, interview script, triage sheet, findings report template
- [x] P1 fix: library subtitle no longer claims "Nothing here yet" while books are still loading

## Trust Before Growth Sprint

### Step 0 — Source of truth
- [x] Inspect the real working tree vs public main; record baseline typecheck/test count/build
- [x] Verify for each task below whether the defect actually still exists before changing code

### P0 — Trust breakers
- [x] Task 1: chapter-detection hierarchy (PDF outline → text headings → LLM validation → synthetic sections) with structureSource/confidence field
- [x] Task 1: synthetic groupings must be named "Section N", never "Chapter N"; low confidence suppresses confident chapter claims
- [x] Task 2: entity extraction returns page evidence; aggregate/normalize/dedupe pages; safe-mode first/last from pages <= currentPage
- [x] Task 2: never render "p.unknown" — omit or state ReadBuddy has not located the appearance
- [x] Task 3: server requires [[p.N]] citations for claims that depend on retrieved earlier material
- [x] Task 3: server-side citation validation — reject future pages in safe mode, reject pages absent from supplied evidence
- [x] Task 4: source-only safe mode; forbid pretrained book knowledge; honest refusal wording without internal/system language
- [x] Task 5: live retrieval actually searches fine-grained retrievalPassages, not only analysis chunks
- [x] Task 6: offset-based annotations (startOffset/endOffset on normalized page text) so multiple highlights per paragraph render; migration for old rows
- [x] Task 7: firstReadablePage on new books; calm empty-page message with next-page action

### P1 — Usability
- [x] Task 8: single-word selection toolbar becomes Define · Translate · Explain; concise 1–3 line Define
- [x] Task 8: Translate with persisted target-language preference
- [x] Task 9: no silent short-selection failure
- [x] Task 10: mobile parity — Ask Book, evidence jump, back-to-page, I'm Lost, spoiler setting, Define, Translate
- [x] Task 11: user-controllable spoiler mode with one-time confirmation, respected across all AI paths
- [x] Task 12: I'm Lost affordance with label, quieter after first successful use
- [x] Task 13: resume recap gated on real elapsed time; no recap after ~40 seconds; no recap on remount
- [x] Task 14: night-mode consistency and contrast across all reader surfaces
- [x] Task 15: conservative heading classification; body text when uncertain
- [x] Task 16: Left/Right page turns only; Up/Down scroll normally
- [x] Task 17: remove the misleading "…" control or give it real actions
- [x] Task 18: thumbs feedback acknowledgement plus compact negative categories
- [x] Task 19: Notebook segmented view — All / Highlights / My notes / AI explanations with jump to source page

### Foundation
- [x] BOOK_BRAIN_VERSION with stale detection and safe background rebuild preserving PDF/pages
- [x] Regression tests for every task above; keep all existing tests passing
- [x] Manual verification of Scenarios A–G in browser

## Authorized Long-Book Verification — Dune PDF

- [x] Inspect the authorized PDF for page count, text availability, outline, and safe upload suitability
- [x] Upload the authorized long-book PDF and verify the non-blocking reader plus Book Brain v4 background pipeline
- [x] Verify long-book retrieval, safe spoiler boundary, evidence-page jump/back, and multi-highlight persistence
- [x] Verify Define/Translate, mobile controls, night surface, conservative text layout, and resume gate on the real book
- [x] Update the Trust Before Growth report and readiness recommendation from real long-book evidence

## Dune Verification Blocker

- [x] P0: first-readable-page must skip front matter such as book lists and open at meaningful book text; add a regression fixture from the Dune upload
- [x] P0: make scheduled Book Brain work mutually exclusive and resumable for long books; preserve staged v4 progress across runs and add concurrency/progress regressions
- [x] P0: when the configured AI provider is unavailable or exhausted, pause Book Brain safely with staged work intact instead of repeatedly failing/retrying chunks
- [x] P0: resume a paused Book Brain only after a bounded cooldown, then continue the same staged queue without rebuilding it
- [x] P0: route whole-book synthesis through the available DeepSeek provider when the shared OpenAI-compatible route is unavailable
- [x] P0: safe retrieval must clip an overlapping evidence passage to the reader’s current page instead of excluding all early-page evidence
- [x] P0: entity extraction must record named characters on early narrative pages so safe Who? can answer from actual page evidence
- [x] P1: Night mode settings popover must use dark semantic surfaces instead of bright paper styling
- [x] P1: Resume recap must describe the actual reopened page, not stale last-progress text after a direct page jump
- [x] P0: bump the Book Brain analysis version so existing completed books safely rebuild with corrected source-derived entity evidence
- [x] P0: safe-mode answers must not add book facts unsupported by the supplied passage evidence, even when their page citation is valid
- [x] P1: make the mobile Ask Book entry visibly named rather than an unexplained icon in the phone reader header

## Production Authentication — Login and Create Account

- [x] Audit existing Manus OAuth routes, sessions, user identity fields, and authentication entry points
- [x] Add dedicated `/login` and `/create-account` pages consistent with the ReadBuddy visual system
- [x] Preserve current Manus OAuth account access while presenting Google and email entry points
- [x] Configure real Google OAuth callback, state validation, account linking, and session issuance
- [x] Later: configure real passwordless email sign-in only after Resend sender/domain verification is complete
- [x] Add authentication regressions for provider state, email-link expiry, account linking, and current-user continuity
- [x] Verify provider success/failure paths, current account continuity, responsiveness, and production build

## Live Authentication Blockers

- [x] P0: diagnose and fix the failed live Google sign-in redirect/callback
- [x] P0: defer failed Resend email delivery rather than expose a broken passwordless-link option
- [x] P0: register every supported ReadBuddy production callback origin in Google Cloud and reject unsupported callback origins safely
- [x] P1: remove the email-delivery surface until Resend sender verification is complete

## Premium Conversion & Desirability Sprint

- [x] Verify mixed vector/non-vector safe retrieval scoring and correct it only if genuinely unsafe
- [x] Verify that Safe Ask Book gives grounded synthesis rather than an overly extractive answer
- [x] Verify false-heading handling for uncertain ALL-CAPS PDF text and correct it only if still broken
- [x] Record baseline typecheck, full test count, production build, desktop/mobile audit, and design findings
- [x] Research premium conversion design principles and document an original ReadBuddy direction
- [x] Redesign the landing page to demonstrate whole-book memory, evidence, and spoiler safety before account creation
- [x] Elevate library, upload/Book Brain anticipation, and pricing presentation without new product features
- [x] Refine reader typography, integrated AI moments, and mobile interaction quality without adding feature bloat
- [x] Document the semantic visual system, type, color, spacing, and motion rules
- [x] Run responsive desktop/tablet/mobile, accessibility, performance, full regression, and production build checks
- [x] Write the real-user desirability study kit and full Premium Conversion & Desirability Sprint report

## Creative Direction Reset — Founder Approval Required Before Implementation

- [x] Audit current desktop, laptop, tablet, and mobile experience plus product, auth, library, upload, reader, evidence, notebook, footer, and browser identity
- [x] Audit domain, favicon, metadata, authentication identity, legal/contact cues, and prepare ReadBuddy-branded domain migration requirements
- [x] Document why the current visual world feels generic, emotionally flat, untrustworthy, or visually empty against the new desirability brief
- [x] Define Direction A: The Living Book, including brand world, psychology map, art/motion system, and product-story strategy
- [x] Define Direction B: Intellectual Editorial, including brand world, psychology map, art/motion system, and product-story strategy
- [x] Define Direction C: The Reading Journey, including brand world, psychology map, art/motion system, and product-story strategy
- [x] Generate high-fidelity desktop and mobile concept boards for all three directions without modifying production code
- [x] Score all directions critically, recommend one, and prepare the founder approval gate
- [x] Stop after founder review; do not implement, deploy, or modify production code until a direction is explicitly approved

## Independent ReadBuddy Authentication

- [x] Audit all logout, login, callback, fallback, and navigation paths for legacy Manus identity redirects or branding
- [x] Replace legacy logout behavior with a ReadBuddy-owned session clear and `/login` redirect
- [x] Remove legacy Manus OAuth login entry points from public and protected ReadBuddy surfaces
- [ ] Verify Google login and account continuity still work after removing legacy Manus routes
- [ ] Test production logout and protected-route fallback so no reader sees a Manus-branded identity screen

## Blank-Page Production Regression

- [ ] P0: diagnose and fix the blank page reported after logout/authentication navigation changes
- [ ] Verify production home, login, logout, and library render correctly after the fix
