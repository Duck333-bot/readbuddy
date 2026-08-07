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
- [ ] Reader and buddy panel need a real uploaded book to verify visually (requires signed-in session)
