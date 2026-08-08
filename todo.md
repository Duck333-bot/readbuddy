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
- [ ] Identify chapter boundaries in bookPages (heuristic: page text starts with "Chapter", "CHAPTER", or numbered sections)
- [ ] Rewrite buildFullText() to chunk by chapter (not 60k char limit)
- [ ] Add chunkAnalysis pass: for each chunk (5–10 pages), generate summary + entities + concepts + important passages
- [ ] Add chapterSynthesis pass: combine all chunk analyses for each chapter into a chapter-level brain
- [ ] Add wholeBookSynthesis pass: combine all chapter brains into the final book brain
- [ ] Update passCompleted enum to track: 1=extraction, 2=chunks, 3=chapters, 4=whole-book, 5=embeddings

### Phase 2: Semantic Retrieval via Embeddings
- [ ] Add bookEmbeddings table: (id, bookId, chunkId, embedding, metadata)
- [ ] Generate embeddings for every chunk using Manus Forge embedding API
- [ ] Implement semantic search: highlight → embed → search all chunks → rerank → return top 5
- [ ] Update buildBrainContext() to use semantic search instead of page-proximity heuristic
- [ ] Test: "remind me what the author said 180 pages ago" returns relevant passages

### Phase 3: Spoiler-Aware Retrieval
- [ ] Filter retrieved chunks by reader's current page before sending to AI
- [ ] Store chunk page ranges in bookEmbeddings metadata
- [ ] In buildBrainContext(), exclude chunks that occur after reader's current page when spoilerMode="safe"

### Phase 4: LLM Provider Abstraction
- [ ] Create server/llm/provider.ts: abstract interface for LLM calls
- [ ] Create server/llm/openai.ts: OpenAI-compatible wrapper (current Forge endpoint)
- [ ] Create server/llm/deepseek.ts: DeepSeek API wrapper (use DEEPSEEK_API_KEY env var)
- [ ] Create server/llm/router.ts: task-based routing (chunk analysis → DeepSeek, whole-book → stronger model, etc.)
- [ ] Update invokeLLM() to use the router instead of hardcoded OpenAI
- [ ] Update bookBrain.ts to use the new provider abstraction

### Phase 5: Testing & Verification
- [ ] End-to-end test: upload a 300+ page book, verify all chunks are processed
- [ ] Verify embeddings are generated for every chunk
- [ ] Test semantic retrieval: query should find relevant passages from anywhere in the book
- [ ] Test spoiler mode: retrieval should exclude future chapters
- [ ] Update vitest mocks for new DB helpers (bookEmbeddings, chunkAnalysis, etc.)
- [ ] Production build passes cleanly
