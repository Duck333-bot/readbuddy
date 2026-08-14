# ZhiyaAI Current-State Audit

**Audit date:** 14 August 2026  
**Repository revision audited:** `94830b5`  
**Purpose:** Establish the actual production baseline before evolving the legacy book-first application into ZhiyaAI’s Material Intelligence and first learning loop.

> This audit is based on the active source, database schema, migrations, and verification commands. Existing task notes are useful history, but are not treated as proof of deployed behavior.

## Baseline Verification

| Check | Result | Verified detail |
|---|---:|---|
| Type check | Passed | `pnpm check` completed with no TypeScript errors. |
| Regression suite | Passed | `28` test files and `146` tests passed. |
| Production build | Passed | `pnpm build` completed successfully. |
| Current migration set | Present | Numbered migrations `0000` through `0018` are present. |
| Working tree at audit close | Planned documentation only | The only uncommitted item is the current `todo.md` planning update. |

The production build does emit chunk-size warnings for some deferred authenticated-product dependencies. This is not a current functional failure, because the public home route remains lazy separated from the authenticated application, but the Material Workspace must preserve that route-level separation.

## What Is Working Today

ZhiyaAI already has a substantial, verified reading foundation. A user can upload a selectable-text PDF, have it stored privately, extract page text, enter the reader immediately, and let the resumable Book Brain pipeline continue in the background. The reader supports page progress, highlights, notes, bookmarks, resume recaps, evidence jumps, contextual questions, and spoiler-aware retrieval for narrative reading.

| Capability | Current source of truth | Preservation requirement |
|---|---|---|
| PDF ingestion | `server/routers/books.ts` and `server/pdf.ts` | Keep the existing PDF flow working unchanged. |
| Background analysis | `server/bookBrain.ts` and Heartbeat job registration | Reuse its resumable, leased, provider-pause-safe model. |
| Semantic retrieval | `bookChunks`, `retrievalPassages`, `bookEmbeddings` | Reuse for all Material Intelligence outputs. |
| Citation safety | `server/bookBrain.ts`, `server/citations.ts`, `server/routers/buddy.ts` | Preserve evidence validation and source-only answer behavior. |
| Spoiler protection | `buildBrainContext()` and reader settings | Keep book-specific safe/full behavior as a first-class reader mode. |
| Reader Intelligence | `readerMemory` and `readerSettings` | Extend gently; do not replace or weaken it. |
| Authentication and ownership | Google-backed users plus protected tRPC procedures | New material records must be owner-scoped by default. |
| Privacy-minimal analytics | `analyticsEvents` and analytics router | Do not add raw material content, questions, or answers to analytics. |

## Current Architecture and Coupling

The current system is intentionally **book-first**. The core `books` row stores both material identity and reader progress. The following persistence tables directly depend on `bookId` and must not be destructively renamed during this milestone.

| Book-bound persistence | Current role | Migration approach |
|---|---|---|
| `books`, `bookPages` | Source file, metadata, page text, progress | Preserve as the legacy reader record and map it into a new Material abstraction. |
| `bookBrain`, `bookChunks`, `bookEmbeddings`, `retrievalPassages`, `bookEntities` | Structured analysis, chunks, vectors, evidence, entities | Reuse their retrieval and operational patterns; introduce Material Intelligence alongside them. |
| `readerMemory`, `readerSettings` | Per-reader vocabulary, concepts, preference, spoiler mode | Preserve as book-reader intelligence; add Learner Intelligence separately. |
| `annotations`, `bookmarks`, `notebookEntries` | Reader-owned highlights, bookmarks, saved answers | Leave book-owned records stable; create distinct material study content and user notes. |
| `analyticsEvents` | Privacy-minimal product events with optional `bookId` | Add optional material/learning metadata only without raw source or answer text. |

The reader route remains `/read/:bookId`, and its data fetching, annotations, notebook actions, evidence jumping, chapter navigation, and spoiler controls all assume pages and a `bookId`. It must remain compatible. The new Material Workspace should therefore add `/material/:materialId` rather than rewrite the reader route.

## Existing Intelligence: What Generalizes and What Stays Book-Specific

The current Book Brain pipeline already provides the right reusable foundation: ordered normalized text, token-bounded chunks, chunk summaries, concept/entity extraction, synthesis, embeddings, fine-grained retrieval passages, LLM-provider routing, processing leases, resumable stages, and temporary provider pauses.

| Reusable as Material Intelligence | Must remain book-specific |
|---|---|
| Parser-normalized sections and source coordinates | Chapter claims based on PDF outlines or conservative heading detection |
| Chunking, embeddings, retrieval passages, evidence validation | Safe/full spoiler boundaries and future-page exclusion |
| Concepts, definitions, examples, source-backed study outputs | Character and relationship treatment for narrative books |
| Leased, resumable background processing | Reader page progress, quiet reading UI, bookmarks, annotations |
| Provider task routing and operation telemetry | “Who was this?” and “I’m lost” reader interaction semantics |

The current LLM router is already provider-abstracted. It selects DeepSeek for economical analysis when configured, falls back to the OpenAI-compatible provider, and reserves OpenAI embeddings for `text-embedding-3-small`. New study tasks must extend this task-based router rather than call any model directly.

## Current Ingestion Boundary

The active upload procedure accepts only PDF bytes. It validates the `%PDF-` signature, limits the file to 40 MB, rejects unreadable or image-only PDFs, stores the original and optional cover in object storage, extracts pages synchronously, and schedules the Book Brain background job. No DOCX, PPTX, TXT, or Markdown parser exists today.

The new Material ingestion path must introduce parser adapters that normalize **text, ordered units, headings, source coordinates, metadata, and detectable structured elements**. The current PDF extraction should become the PDF adapter rather than be discarded.

## Rebrand Status

The visible product rebrand is substantially complete. The public homepage, document metadata, account entry, Upload, Reader labels, assistant-facing copy, and boot state were moved to **ZhiyaAI** in prior verified checkpoints.

The audit found a small, concrete cleanup list:

| Location | Finding | Required action |
|---|---|---|
| `client/src/lib/bookBrainReadiness.ts` | Several user-facing progress details still say “ReadBuddy.” | Replace with ZhiyaAI during visible-brand cleanup. |
| `client/src/components/reader/InlineAnswerCard.tsx` | Trust-feedback acknowledgment still says “ReadBuddy.” | Replace with ZhiyaAI. |
| Marketing prototype components | A few historical “ReadBuddy” labels remain in landing/marketing component source. | Audit whether rendered; remove or rename any user-visible text. |
| `server/domainIdentity.ts` | Legacy redirect target remains the technical `readbuddy-fqfwwm4a.manus.space` hostname. | Keep stable until a ZhiyaAI custom domain is selected; do not risk auth or redirect behavior in this milestone. |

Internal `bookId`, Book Brain, and legacy-host identifiers are not user-visible rebrand failures and should not be mechanically renamed.

## Safe Evolution Decisions

The implementation will introduce new Material and Learner Intelligence records beside the legacy book data. Existing books will be mapped into a Material record through a stable compatibility link rather than copied or renamed wholesale. New non-book uploads will use the Material path. The Material Workspace will become the new shared learning surface, while the existing reader remains the best `Read` mode for legacy books.

This approach intentionally avoids the highest-risk failure mode: a global `Book → Material` rename across tables, routes, reader state, analysis jobs, citations, and owned data.

## Audit Risks

The main engineering risks are parser quality for DOCX/PPTX, structured LLM output reliability, keeping generated study content grounded, and ensuring background processing remains within managed hosting limits. The first learning loop must use bounded work, Zod validation, explicit failure states, retries where appropriate, and source references rather than pretending every material has perfect structure.

The largest product risk is building disconnected features. Notes, flashcards, quizzes, and lessons will therefore consume one shared concept model and update one transparent learner-mastery model rather than independently generating separate interpretations of the material.

## Implementation Gate

The baseline is healthy. The next phase is a backward-compatible Material and Learner Intelligence schema design, followed by a single ordered migration. No existing `books` table, reader route, spoiler safeguard, annotation, bookmark, or Book Brain data will be renamed or removed as part of that phase.
