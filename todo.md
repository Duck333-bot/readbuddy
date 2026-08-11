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
