# Trust Before Growth — Implementation Log

Running record of what has actually been changed, so the final report is factual.

## Schema (migration `0012_clean_wong.sql`, applied)

| Change | Purpose |
|---|---|
| `books.firstReadablePage` | Open new books on real text instead of a cover |
| `books.pdfOutline` | Store the PDF's own bookmark outline for chapter detection |
| `bookBrain.structureSource` (`outline`/`detected`/`synthetic`) | Know where chapter structure came from |
| `bookBrain.structureConfidence` (0–100) | Suppress confident chapter claims below 50 |
| `bookBrain.analysisVersion` | Detect stale brains for background rebuild |
| `annotations.startOffset` / `endOffset` | Stable multi-highlight anchoring |

## Task 1 — Chapter detection (done)

New module `server/bookStructure.ts` implements the four-source hierarchy: PDF outline (confidence 0.95, real titles), textual headings after running-header rejection (0.55–0.8), optional cheap-LLM classification of ambiguous candidates (candidate lines only, never the book), and synthetic `Section N` grouping (0.2, `authorDefined: false`). `server/pdf.ts` now reads `getOutline()` and resolves every destination to a real page number, and exposes `findFirstReadablePage`. `runPass2` consumes the resolved structure and stores real titles, `endPage`, and `authorDefined` per section.

## Task 2 — Entity evidence (done)

Chunk analysis now returns structured entities with page numbers drawn from the `[Page N]` markers. `normalizeChunkEntities` discards any page the model invented (it must exist in that chunk), `mergeEntityEvidence` merges aliases and prefers the longer surface form, and pass 3 only adds descriptions via `updateBookEntityDescription` so page evidence is never overwritten.

