# ZhiyaAI Foundation Acceptance Record

## Verified execution record

The following results were verified on the development environment using an authenticated owner session and a non-sensitive acceptance Material about cell membranes. Where a format was tested at parser level rather than as a complete UI upload, that distinction is stated explicitly.

| Scenario | Result | Evidence |
|---|---|---|
| Material upload and source preservation | **Passed** | A Markdown material uploaded through the real Material Workspace became available immediately with three normalized source units. |
| Background Material Intelligence | **Passed** | The same Material reached `pipelineStage = complete`, `passCompleted = 3`, one stored chunk, and three stored source-backed concepts after scheduled processing. |
| Flashcards | **Passed** | A real three-card set was generated from verified concepts; reveal and a `Good` rating advanced the card. |
| Quiz and mastery | **Passed** | A correct source-grounded answer displayed feedback and evidence while recording the answer for learner mastery. |
| Personal and generated notes | **Passed** | A generated source-linked note and a real owner-created note persisted under the Material. |
| Adaptive Lesson | **Passed** | The Material created a persistent 12-step lesson. Explain, example, check, adapt, progress, and learner self-assessment advanced through real stored steps. |
| Legacy Reader compatibility | **Passed** | The existing 1,200-page Dune Reader opened at `/read/420001`, retained progress and resume behavior, and displayed ZhiyaAI wording. |
| Long PDF parsing | **Passed** | The authorized Dune PDF produced 1,200 normalized units and 973,891 extracted characters through the generalized Material PDF adapter without creating a new product record. |
| DOCX and PPTX adapters | **Passed** | Automated parser fixtures exercised a real minimal DOCX package and ordered PPTX slide XML extraction. |
| Ownership isolation | **Passed** | Router tests reject anonymous access, list owner-scoped Materials, and reject a cross-user Material lookup. |
| Mobile workspace routing | **Passed** | The Material Workspace rendered on a 375 px viewport with a readable overview, horizontally constrained study navigation, and stacked source-grounded content. |

## Failure behavior verified

Invalid PDF bytes are rejected truthfully rather than being given invented text. Scanned/no-selectable-text PDFs produce a clear limitation message. Material Intelligence pauses when a provider response cannot be source-validated and exposes a retry path after the deployed background callback is available. Parser support intentionally does not imply that a malformed office archive is accepted.

## Regression record

The final full suite passed with **161 tests across 32 test files**, including six Material parser tests with Buffer and `Uint8Array` PDF input normalization plus three Material ownership-isolation tests. The final production build completed after releasing disposable browser and TypeScript-watch workers in the constrained sandbox.

## Interpretation

The first learning loop is functional: **source → normalized Material → verified concepts → study artifact → explicit learner signal → resumable next step**. The record does not claim that every supported format was uploaded through the complete visual flow, only that PDF, DOCX, PPTX, TXT, and Markdown have parser adapters and focused regression coverage, while Markdown exercised the complete UI path.
