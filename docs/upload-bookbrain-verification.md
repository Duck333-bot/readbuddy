# Upload / Book Brain Verification

## Real-state checks

The redesigned dialog was exercised through the development owner session with the previously authorized 1,200-page Dune PDF. The selected-file state displayed the actual filename and 2.8 MB size. The upload moved through real browser preparation and server ingestion, then returned a real book record (`bookId 420001`) with 1,200 pages and an existing ready-to-read transition. Opening the first readable page successfully entered `/read/420001`.

After reader readiness, the Book Brain response reported the initial state and the interface showed **“Text and reading structure are ready”** rather than implying that later connections or evidence work had already finished. The deeper pipeline remained explicitly non-blocking.

## Failure and retry

A local non-PDF fixture with a `.pdf` filename was submitted through the real server contract. The server returned **“Invalid PDF structure.”** The dialog retained the selected file and displayed an inline **“This book needs another try”** message with the existing retry action. No synthetic processing status was used.

## Desktop and mobile composition

On desktop, the dialog keeps the book and four restrained reading-native fragments on the dark Understanding Room side, while the action remains a calm paper surface. On a 390 px phone viewport, the interface uses a vertical composition: the central book object and short state statement appear first, followed by the file action or selected-file form. This is not a scaled two-column layout.

The full-page mobile selected-file capture includes Library content below the modal viewport because the browser’s full-page screenshot captures the obscured page behind the dialog. The actual first phone viewport contains the designed vertical Upload composition and action without that background content competing for attention.

## Scope confirmation

Only Upload / Book Brain visual code, its real status contract, shared Memory Terrain styles, focused tests, task tracking, and this verification record changed. Landing, Library, Reader, Notebook, pricing, final logo selection, ingestion semantics, Book Brain scheduling, and reader behavior remain unchanged.

## Regression and deployment checks

The complete suite passed with **26 test files and 142 tests**. Type checking passed. The production build initially exceeded the sandbox’s available memory while the TypeScript watch process was active; after releasing that nonessential watch worker, the same production build completed successfully. Recent development browser-console and server logs contained no uncaught client or server errors from the redesign.
