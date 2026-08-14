# ZhiyaAI Material-Generated Micro-Lesson Redesign Audit

## Correct product contract

ZhiyaAI does not ship fixed curriculum lessons. A user uploads a source, Material Intelligence identifies source-backed concepts and evidence, and ZhiyaAI turns that specific material into a short interactive revision lesson. A lesson is therefore a generated learning flow, not a generic subject page and not a document chat transcript.

## Findings in the recovered foundation

| Area | Current behavior | Gap against the corrected brief | Required redesign |
|---|---|---|---|
| Lesson generation | Creates repeated `explain → example → check → adapt` steps for up to three concepts. | It has no deliberate seven-minute narrative, visual understanding step, recap, or integrated flashcards. | Generate a compact, material-specific sequence that alternates teaching, visual understanding, checking, retrieval practice, and recap. |
| Lesson UI | Renders inside the Material Workspace tab as a small bordered card. | It resembles an internal tool, lacks focused progress/navigation, and does not hold attention. | Use a dedicated focused lesson route with one centered card, top progress, close/previous controls, and bottom navigation. |
| Visual learning | Shows only text from the source. | It cannot make relationships, comparisons, or processes easier to see. | Use source-backed deterministic comparison, sequence, and relationship diagrams when a concept contains enough supported structure. |
| Flashcards and quizzes | Grounded persistent artifacts already exist. | They are separate tabs rather than part of an intentional lesson ending. | Reference the same persistent source-backed artifacts from lesson flashcard and MCQ steps. |
| Library and workspace | Functional but sparse cards and tabs. | They do not yet communicate a premium consumer learning product. | Establish clearer material hierarchy, visual readiness states, generous spacing, and a strong “Start revision lesson” entry point. |

## Design contract

The lesson player uses a light premium visual system with a centered content stage, restrained pastels by information type, generous whitespace, rounded cards, subtle elevation, progress feedback, and short step-to-step motion. Blue identifies worked examples and visual learning, green identifies sourced notes, warm yellow identifies concepts, soft rose identifies common mistakes or incorrect answers, and violet identifies flashcards and hints. The experience remains ZhiyaAI-original; no third-party branded assets, mascots, copy, or exact compositions are used.

## Grounding rules

Every lesson step stores the material concept and evidence references it uses. A visual block may only visualize relationships already present in the concept definition, examples, or source-supported evidence. If a source lacks enough structure for a useful chart or diagram, ZhiyaAI uses a clear comparison or evidence excerpt rather than inventing facts. MCQ answers, flashcards, recap, and learner updates retain the existing persistent grounding and ownership rules.

## Implementation verification note

On 2026-08-14, the live development route for an existing completed material generated a real nine-step lesson for the uploaded **Cell membranes — acceptance check** source. The populated first card showed the material-specific concepts, its source label, the top progress rail, close and previous/next controls, a focused centered stage, and the bottom “Begin lesson” action. This confirms the player is no longer embedded as a workspace-tab card and that its introduction is generated from stored Material Intelligence concepts rather than fixed subject copy.

The player’s top previous/next controls are independently available from the bottom primary action. The embedded review environment places platform chrome over the bottom viewport; therefore, the next-card verification uses the top navigation rather than treating an obscured bottom coordinate as a lesson interaction failure.

The real second card rendered a blue source-backed comparison between **Selective permeability** and **Cell membrane function**, with both definitions drawn from the accepted material and a transparent section citation. The real third card rendered the stored source excerpt as the worked understanding block and named the specific concept it supports. Top navigation was used for this inspection only; no learner-completion or mastery signal was recorded.

The fourth and fifth cards rendered two distinct violet MCQ states from persistent grounded quiz records. Each question named a concept present in the uploaded material and offered the same three source-derived definitions as choices. The inspection did not submit an answer, so it did not create a learner signal or alter the user’s mastery state.

The sixth card rendered a green key-reminders note with the three actual material concepts and definitions. The seventh card rendered the first of three persistent flashcards in the same lesson flow, with a tap-to-flip prompt/answer treatment, a next-card action, and optional skip. No card rating or lesson completion action was triggered during this inspection.

The eighth card rendered a source-grounded green recap with the same three verified concepts, and the ninth card rendered the completion/continuation message. Together, the live session covered intro, visual comparison, worked evidence, two MCQs, notes, flashcards, recap, and a continuation path in nine focused steps. Top navigation kept this browser review non-persistent; no real lesson completion was recorded.
