# ZhiyaAI Material and Learner Intelligence Design

## Decision

ZhiyaAI will add a **Material** domain beside the existing book model. It will not rename or remove `books`, `bookPages`, Book Brain, or any reader-owned table. Legacy books will receive a linked Material record through `materials.legacyBookId`; `/read/:bookId` remains the protected reading contract, while new study surfaces use `/material/:materialId`.

> A Material is the shared source object used by understanding, notes, flashcards, quizzes, lessons, and learner mastery. A Book remains the specialized legacy reading object that supplies page-based reading and spoiler-safe narrative behavior.

## Core Records

| Record | Responsibility | Compatibility decision |
|---|---|---|
| `materials` | User-owned source identity, file metadata, material type, normalized-unit count, and processing state | Links optional `legacyBookId` to an existing `books` row. |
| `materialUnits` | Ordered normalized source units with page/slide/section references | Does not replace `bookPages`; legacy PDF pages are mirrored into Material units only when needed. |
| `materialIntelligence` | Shared resumable analysis status, summary, objectives, and synthesis | Uses a common pipeline vocabulary without deleting Book Brain. |
| `materialChunks`, `materialRetrievalPassages`, `materialEmbeddings` | Chunking, semantic retrieval, and source evidence for non-reader material flows | Mirrors proven Book Brain patterns with material coordinates instead of page-only assumptions. |
| `concepts` | Shared concepts with definitions, aliases, importance, prerequisites, related concepts, examples, and evidence | One source of truth for Notes, Flashcards, Quiz, Lessons, and Learner Intelligence. |
| `learnerConceptMastery` | Transparent per-user concept state and interaction counts | Keeps four human-readable states: New, Learning, Familiar, Strong. |
| `learnerSignals` | Privacy-minimal source of mastery updates | Stores event type and numeric/state evidence, never source text or learner answers. |
| `materialNotes`, `flashcards`, `studyQuizzes`, `quizQuestions`, `quizAnswers` | Persistent, evidence-grounded study artifacts | Keeps generated material distinct from personal notes and user answers. |
| `lessons`, `lessonSteps` | Resumable adaptive teaching sequence | Stores validated structured steps, check outcomes, evidence, and current position. |

## Ownership and Evidence Rules

Every new record is scoped to a user-owned Material. Every read or mutation first verifies material ownership. Generated content has an explicit source-evidence field containing only material coordinates and short supporting excerpts. Product analytics remains separate and never receives raw source text, questions, answers, or generated study content.

## Ingestion and Intelligence Contracts

Each parser returns the same internal payload:

```ts
type NormalizedMaterial = {
  title: string;
  source?: string | null;
  materialType: MaterialType;
  fileType: MaterialFileType;
  mimeType: string;
  units: Array<{
    index: number;
    type: "page" | "slide" | "section";
    title?: string | null;
    text: string;
    sourceRef: SourceRef;
    headings: string[];
  }>;
  metadata: Record<string, unknown>;
};
```

Material Intelligence consumes the normalized units, creates source-preserving chunks and retrieval passages, extracts shared concepts, and records a resumable processing state. Book Brain remains responsible for narrative-only structure and spoiler-aware reader behavior.

## Learner Intelligence V1

Mastery updates are deliberately conservative. A correct quiz answer increases evidence; an incorrect answer reduces confidence; repeated Simplify or Define actions increase difficulty signals; exposure alone does not create mastery. The UI exposes a qualitative state rather than claiming scientific precision.

| Observable evidence | V1 effect |
|---|---|
| First generated concept | New |
| Explanation, Define, or Simplify request | Learning signal and explanation counter |
| Correct material-grounded check | Increase correct count and confidence evidence |
| Incorrect check | Increase incorrect count, return to Learning, prioritize for lesson/flashcard/quiz |
| Repeated correct checks | Familiar, then Strong after sufficient evidence |

## Migration Sequence

1. Add the new tables and enums only.
2. Backfill a Material row for every existing book, without changing the existing book row or reader URLs.
3. Ship Material APIs and parsers for new uploads.
4. Reuse Book Brain patterns for new Material Intelligence.
5. Build the Material Workspace and study loop.
6. Later, consider retiring duplicated derived data only after observed compatibility and migration confidence.

## Explicit Non-Goals for This Milestone

Audio, video, webpage ingestion, OCR, spreadsheet analysis, podcast generation, classroom management, collaboration, social features, Anki export, advanced spaced repetition, and a cross-material graph UI are deferred. The parser and concept architecture leaves room for them without exposing fake controls.
