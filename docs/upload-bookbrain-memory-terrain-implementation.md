# Upload / Book Brain — Memory Terrain Implementation

## Scope and boundary

This implementation applies only to `UploadBookDialog` and its Book Brain continuation state. It does not change Upload APIs, PDF extraction, validation, S3 storage, Book Brain scheduling, retry semantics, reader entry, Library, Reader, Notebook, pricing, or final logo selection.

## The single visual thesis

> **A book gradually becomes organized enough to help you read.**

The uploaded book stays at the center. Small reading-native objects—page fragments, margin annotations, evidence brackets, and a restrained connection line—arrive only when the associated backend truth exists. This is not an AI-brain illustration and not a simulated dashboard.

## Real-state mapping

| Actual product state | Reader-facing statement | Visual behavior | Prohibited implication |
|---|---|---|---|
| No file selected | “Bring in a book” | A single empty book frame with one Page Shard and a file drop field. | No claim that analysis has started. |
| PDF selected, before upload | “This is the book ReadBuddy will get to know.” | The filename, size, editable title, and a centered book object. | No percentage or completed learning claim. |
| Browser preview and upload work | “Preparing the first readable pages.” | The central book gathers real page fragments; a non-numeric activity rail reflects local reading/upload work. | No fake percentage or Book Brain completion signal. |
| Upload returns successfully | “Your book is ready to read.” | The book settles, first readable page becomes visible, and the open-reading action appears immediately. | No requirement to wait for deep analysis. |
| Background pass 1 / initial stage | “Text and reading structure are ready.” | The first Page Shard locks onto the book. | No claim that chapters are author-defined unless the backend says so. |
| Background chunk stage | “Finding chapters, people, and ideas in the book.” | A bounded number of Margin Marks appear around real page fragments. | Do not say ReadBuddy understands the reader. |
| Background synthesis stage | “Connecting the ideas that matter.” | One controlled Margin Thread connects two book fragments. | No invented connection count or percentage. |
| Background embedding stage | “Making earlier pages easy to find when they help.” | Evidence Bracket completes around the current book object. | No assertion that full analysis is already complete. |
| Background complete | “I know this book now.” | The four primitives settle into one quiet complete composition. | No technical provider/pipeline language. |
| Paused/retry/provider failure | “This book is safe. ReadBuddy will continue when it can.” | The existing completed fragments remain in place; a small action supplies retry where the current implementation supports it. | No lost-progress language and no false completion. |
| Upload/extraction failure | The existing precise error message and retry path. | The book frame opens again, retaining the selected file when the current behavior permits it. | No vague ‘something went wrong’ copy. |

## Desktop composition — approximately 55% richness

The desktop dialog becomes a wide, dark-ink ‘understanding room’ on the left and a warm paper action surface on the right. The central book is physically large, with no more than four derived fragments. Color comes from the Memory Terrain palette: a periwinkle floor, blush chapter field, mint structure shard, and apricot evidence mark. Color is compositional, not a background gradient.

## Mobile composition

The mobile experience is a vertical sequence, not a squeezed two-column dialog. It begins with the central book object and one status sentence, then shows the file action or reader-ready action directly below. The derived fragments appear in a shallow layered stack behind the book and never make the screen feel like a dashboard. Processing language stays visible without a side panel.

## Branded versus generic controls

Margin Marks are permitted for reading-native moments: recognized text, book structure, people/entities, evidence, and return to reading. Standard controls remain standard: close, remove file, input editing, and navigation retain accessible utility icons and labels.

## Acceptance criteria

The redesigned interface must tell the truth at every state; a reader can begin at the exact existing ready-to-read moment; a long book can continue in the background; any staged work survives pauses or retries; and desktop/mobile surfaces keep the book—not visual decoration—as the primary object.
