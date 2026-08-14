# ZhiyaAI Lesson Engine Quality Repair — Design Contract

## Goal

The lesson engine must teach the source’s main idea with clean, bounded, source-supported evidence. It must never convert PDF boilerplate, author blocks, slide agendas, headers, footers, or a heading glossary into a confident lesson.

## Non-goals

This repair does not add another product surface, model provider, social feature, or a general chat experience. It changes only the existing Material Intelligence → study artifacts → focused lesson path.

## Layer 1 — Source cleaning and evidence quality

The original uploaded units remain unchanged and readable in the workspace. Material Intelligence chunks become a **learning-safe representation**: a lightly cleaned, bounded version used for concepts, retrieval, study artifacts, and lessons.

| Rule | Outcome |
|---|---|
| Remove publisher/reuse notices, author-affiliation blocks, page numbers, copyright/confidentiality lines, and email-address runs from learning chunks. | A paper’s first meaningful claim is not displaced by its title-page boilerplate. |
| For research-style first pages, preserve the abstract and prose after it rather than the title and author block. | Concepts can be grounded in the paper’s actual claim. |
| Skip low-information title and agenda slides when other substantive slides exist. | Presentation headings cannot become the lesson curriculum. |
| Extract evidence around a named concept rather than always taking the first 500 characters of a chunk. | A concept receives the most relevant supported passage, not an arbitrary page opening. |
| Reject concept definitions and examples that are too long, contain boilerplate markers, email addresses, or lack readable prose. | ZhiyaAI pauses or narrows the lesson instead of turning poor extraction into teaching. |

## Layer 2 — Persisted lesson plan

Material Intelligence will store a compact **lesson plan** in the existing structured Material Intelligence summary. No migration is required. It includes a central question, a narrative statement, ordered concepts, optional visual relationship, and source-cited checks.

| Field | Contract |
|---|---|
| `centralQuestion` | A reader-facing question that captures the source’s central mechanism, argument, or decision. |
| `narrative` | A short source-faithful explanation of how selected concepts connect. |
| `conceptOrder` | Three to five validated concepts selected for importance, dependency, and teaching value—not simply an extraction order. |
| `visualPlan` | `comparison`, `sequence`, or absent. It is stored only when the supplied evidence demonstrates a useful relationship. |
| `checks` | One or two source-cited interpretation, distinction, or decision checks. Definition matching is used only as a fallback for clean simple note material. |
| `estimatedMinutes` | Derived from actual reading length and planned cognitive work, bounded to 3–8 minutes. |

The planning prompt may only use the cleaned chunks and must name an evidence chunk for each stored relationship or check. The persistence layer discards plans that reference unavailable concepts or low-quality evidence.

## Layer 3 — Adaptive lesson assembly

The focused player remains unchanged. The generator uses the plan to choose the **minimum useful teaching moves**.

| Evidence pattern | Selected step |
|---|---|
| Central claim and compact definitions | Concept note and short explanation |
| Causal chain, stages, or ordered mechanism | Sequence visual plus worked explanation |
| Meaningful contrast between two concepts | Comparison visual |
| Concrete example or source scenario | Worked example |
| Decision, trade-off, or source-stated implication | Application MCQ |
| Stable compact knowledge | Flashcard |
| No useful visual or retrieval target | Omit that step rather than filling the template |

Every lesson still has a calm beginning, one or more understanding moments, a check when justified, retrieval practice when useful, and a recap. It is no longer required to contain the same nine cards.

## Safety and rollback rules

1. Lessons with missing clean evidence fail safely with a clear “lesson still preparing” state rather than generating low-trust content.
2. The original material remains unchanged. The cleaning layer is used only for learning analysis.
3. Existing version-two lessons remain readable. The repair creates a new version-three lesson and retires obsolete active versions for that user and material.
4. Existing flashcards and quizzes remain available; the focused lesson may prefer higher-quality plan checks without removing the original artifact set.
5. Every new lesson step stores its evidence, and server-side MCQ grading continues to use persisted expected answers.

## Acceptance test

The exact three founder-review sources must be regenerated. The research lesson must begin from a clean claim about the Transformer rather than page-one boilerplate. The business lesson must teach how evidence shifts by investment stage rather than enumerate slide labels. The school lesson must use either a real relationship visual or no visual; it must not show a decorative definition pair. No lesson may claim a 5–8 minute duration without enough actual reading or cognitive work to justify it.
