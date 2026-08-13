# Premium Conversion & Desirability Sprint — Phase 0 Trust Baseline

**Date:** 2026-08-13  
**Baseline:** Typecheck clean; 22 test files / 134 tests passing; production build successful.

## Findings and decisions

| Risk reviewed | Finding | Action |
|---|---|---|
| Mixed vector/non-vector safe retrieval scoring | **Real defect.** A safe passage clipped at the reader’s boundary has its vector intentionally removed, but was excluded whenever any fully embedded passage existed. | Fixed. All eligible passages now receive one comparable hybrid score: keyword relevance, semantic similarity when available, and safe page proximity. |
| Safe Ask Book overly extractive | **Real limitation.** The previous safety guard returned quotations only, even when reached evidence supported a concise explanation. | Fixed. Safe Ask Book now attempts a short, citation-required synthesis using only reached evidence. Unsupported terms or missing citations fall back to extractive evidence. |
| False headings from uncertain ALL-CAPS page text | **Not a live structural defect.** ALL-CAPS lines are candidate signals only; author-facing structure uses outline, explicit/front-matter, numbered, or Roman candidates. Ambiguous candidates are validated or fall back to synthetic sections. | No broad rewrite. Preserve the existing conservative hierarchy and regression tests. |

## Design-sprint constraint

The redesign must preserve these trust boundaries. Reader-facing premium design cannot make Book Brain, citations, spoiler boundaries, or evidence navigation feel less clear or less reliable.
