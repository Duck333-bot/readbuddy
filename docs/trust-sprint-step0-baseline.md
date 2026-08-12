# Trust Before Growth — Step 0 Baseline

## Source of truth

Working tree `main` at `712ea3c` is identical to `origin/main` and `user_github/main`; the only uncommitted file is `todo.md`. There is no divergence between the local tree and public main, so the code inspected below is the code the alpha readers used.

Baseline: typecheck clean, **104 Vitest tests passing**, production build succeeds.

## Defect verification (do the alpha failures still exist?)

| Task | Verified state in code | Still broken? |
|---|---|---|
| 1. Chapter detection | `server/bookBrain.ts:51` `isChapterBoundary` is a pure regex over the first 5 lines; any ALL-CAPS line 3–60 chars counts as a chapter. `server/pdf.ts` never calls `getOutline()`, so PDF bookmarks are unused. Titles are always overwritten with `Chapter ${n+1}` (`bookBrain.ts:255`). Synthetic fallback groups are also labelled `Chapter` and there is no confidence/source field. | **Yes — fully broken** |
| 2. Entity evidence | `runPass3` inserts entities with `pages: []` and `relationships: []` (`bookBrain.ts:352-353`). Page evidence is never extracted from chunks, so Who? has no page data and the prompt tells the model to print `p.unknown` (`readingBuddy.ts:59-60`). | **Yes — fully broken** |
| 3. Citations | The client parses `[[p.N]]`, but no prompt instruction requests that syntax and no server-side validation of cited pages exists. | **Yes** |
| 4. Pretrained leakage | `BASE_SYSTEM` says "never invent facts" but never forbids using remembered knowledge of a recognised book. | **Yes** |
| 5. Fine-grained retrieval | `retrievalPassages` are generated and embedded in `runPass4`, but `buildBrainContext` searches only `getBookEmbeddings` (analysis chunks). The fine-grained passages are dead data in the live path. | **Yes — confirmed** |
| 6. Multiple highlights | `annotations` has no offsets (`drizzle/schema.ts:112`), so rendering must use text matching and cannot distinguish repeated text or overlapping highlights. | **Yes** |
| 7. Blank first page | No `firstReadablePage` concept anywhere; new books open at page 1 regardless of whether it has text. | **Yes** |

## Consequence

Every P0 in the sprint brief is a real, current defect. None were silently fixed by earlier work, so the sprint proceeds in full.
