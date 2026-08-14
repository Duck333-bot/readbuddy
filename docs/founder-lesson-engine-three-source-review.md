# Founder Review — ZhiyaAI Lesson Engine on Three Real Source Types

## Decision standard

This is a **learning-quality gate**, not a feature-development sprint. The lesson engine passes only if each source produces a coherent, material-faithful short lesson that helps a reader form a better mental model than they had before. A visually attractive sequence that merely summarizes or drills isolated facts does not pass.

## Test sources

| Source type | Material | Why it is a meaningful test | Main teaching challenge |
|---|---|---|---|
| School material | Existing uploaded **Cell membranes — acceptance check** notes | Short, structured, and concept-led. It checks whether the engine can teach definitions and causal biological relationships without overexplaining simple content. | Select the three ideas that unlock the source and connect them rather than treating them as a vocabulary list. |
| Dense research | **Attention Is All You Need** (15-page research paper) | A technical, deliberately unfamiliar source with architecture, mechanisms, performance claims, and mathematical language. | Build an intelligible mental model of the Transformer without inventing simplifications that the paper does not support. |
| Business presentation | **Navy Private Capital: Investor Presentations** (16-slide public presentation) | A slide-native business source covering fundraising narrative, stage-specific priorities, metrics, risks, and decision criteria. | Preserve the causal business argument and distinguish useful investor signals from a disconnected metric glossary. |

## Strict scorecard

Each source is assessed on a 0–5 scale. A **4** means a standard that is strong enough to ship to a thoughtful user. A **5** means it creates a genuine "that helped me understand" moment. Any score below 4 on source faithfulness, lesson coherence, or learning outcome blocks a pass.

| Criterion | What a passing lesson must demonstrate |
|---|---|
| Duration and pacing | The sequence is realistically completable in approximately 5–8 minutes, without inflated time estimates or rushed cognitive jumps. |
| Concept selection | The lesson prioritizes the source’s central mechanisms, arguments, and decisions rather than frequency-biased or arbitrary extracted terms. |
| Teaching quality | It explains why concepts matter and how they relate before asking the reader to recall them. |
| MCQ quality | Questions require interpretation, distinction, or application of the source—not wording recognition or trivia. |
| Flashcard value | Cards contain compact, durable knowledge the reader would reasonably want to retrieve later. |
| Visual necessity | A visual represents a genuinely useful source-supported relationship, comparison, process, or structure. It is omitted when it would only decorate. |
| Source faithfulness | Explanations, examples, answers, and visuals stay inside the uploaded material’s evidence. Interpretation is clearly modest and never invented. |
| Lesson coherence | The order creates one educational narrative: orient → understand → connect → check → retrieve → recap. It must not feel like isolated AI widgets. |
| Visual and interaction quality | The focused experience feels calm, clear, responsive, and suitably premium relative to the product-quality bar set by RevisionDojo. |
| Mobile quality | Core actions remain reachable, readable, and smooth on a phone, including navigation, MCQ selection, and flashcard flip. |
| Net understanding | After completion, the evaluator can explain the source’s main point and at least one important relationship in their own words. |

## Source references

1. [Vaswani et al., *Attention Is All You Need*, arXiv:1706.03762](https://arxiv.org/abs/1706.03762)
2. [Navy Private Capital, *Investor Presentations* (June 2024)](https://www.navysbir.com/programs/docs/Navy_Private_Capital_Investor_Presentations.pdf)
3. [LibreTexts, *6.2: The Cell Membrane*](https://bio.libretexts.org/Courses/Lumen_Learning/Anatomy_and_Physiology_I_(Lumen)/06%3A_Module_4-_The_Cellular_Level_of_Organization/6.02%3A_The_Cell_Membrane)

## Review status

The scorecard and source selection are complete. The evaluation will report observed output, not assumed capabilities. It will identify whether the present fixed template is acceptable, which source types expose weaknesses, and whether adaptive lesson-type selection should become the next narrowly scoped engine improvement.

## Observed finding — dense research source

The live first lesson card for **Attention Is All You Need** does **not** pass the source-faithfulness or teaching-quality gate. It labels a lesson around “Generalization to Parsing,” but the displayed definition begins with the paper’s reuse-attribution notice, author list, and an incomplete abstract. This is an extraction and evidence-window failure: the lesson remains technically sourced, but its selected evidence is not semantically clean enough to teach from. Consequently, the current lesson cannot be judged as a real 5–8 minute learning experience for this source; it must be classified as **blocked by a P0 lesson-engine quality defect**.

## Observed finding — business presentation source

The live first business-lesson card is readable and materially faithful at the definition level. It names funding details, investor-presentation dos and don’ts, and defense-specific challenges. However, it opens with a list of deck headings rather than the deck’s central business logic: *an investor presentation must adapt what it proves to the company’s stage, market credibility, and risk profile.* This lesson therefore has a usable foundation, but it has not yet shown that it teaches the presentation’s causal argument instead of arranging its slide labels into the standard template.

The live visual card is clean and legible, but it simply places two unrelated categories side by side. It does not improve understanding of either the presentation’s narrative or its decision logic. The live worked-evidence card quotes the title, agenda, copyright notice, and an incomplete opening sentence. It then says only that the passage supports the definition. This does not create a worked explanation. It confirms that the dense-research failure is a broader **evidence-window and lesson-synthesis failure**, not a one-off paper-format issue.

## Observed finding — school material source

The school-material opening is clean, concise, and clearly attached to the source. Its selected ideas—selective permeability, membrane function, and diffusion—are appropriate for the short notes. The current template works best in this narrow case because the notes already contain compact definitions. Even here, the lesson is principally a definition-and-recall sequence: its visual is a two-definition comparison, its questions ask which definition matches a named term, and its flashcards restate those definitions. It helps the reader remember terms, but it does not yet use an example or a genuine relationship diagram to teach *why* selective permeability and diffusion jointly matter.

## Scorecard results

Scores use the 0–5 standard defined above. A source needs at least **4** for source faithfulness, lesson coherence, and net understanding to pass this founder gate.

| Criterion | School material: cell membranes | Dense research: *Attention Is All You Need* | Business presentation: investor presentations |
|---|---:|---:|---:|
| Duration and pacing | 2 | 0 | 2 |
| Concept selection | 4 | 1 | 2 |
| Teaching quality | 2 | 0 | 2 |
| MCQ quality | 1 | 0 | 1 |
| Flashcard value | 3 | 0 | 2 |
| Visual necessity | 1 | 0 | 1 |
| Source faithfulness | 5 | 0 | 3 |
| Lesson coherence | 2 | 0 | 2 |
| Visual and interaction quality | 4 | 4 | 4 |
| Mobile quality | 3 | 1 | 3 |
| Net understanding | 3 | 0 | 2 |
| **Total / 55** | **30** | **6** | **24** |

### What was actually tested

The school notes already existed as an uploaded material. The research paper and business deck were each uploaded through the protected production-equivalent material endpoint, parsed into 15 and 16 source units respectively, and processed by the same Material Intelligence function used by the scheduled handler. The generated lessons were then inspected as persisted user-facing lesson records and in the live player. This was not a mocked evaluation.

The research paper is a 15-page source that argues for a Transformer based solely on attention mechanisms, while the business deck is a 16-slide source explaining how investor materials should connect company stage, market evidence, metrics, risks, and fundraising narrative. [1] [2]

## Detailed verdicts

### 1. School material — **does not pass the founder bar**

This is the current engine’s best case. The three selected concepts are sensible, the definitions are concise, and all visible claims remain faithful to the notes. The problem is pedagogical: the full flow is fixed as intro → visual comparison → quote → definition-match MCQs → definition flashcards → recap. It declares approximately seven minutes by assigning one minute to almost every card, but the actual intellectual work is substantially shorter because the questions and cards are simple recognition of the same definitions.

The user would probably retain the three terms. They would not necessarily understand membrane transport better. The visual comparison is decorative rather than explanatory, and the lesson lacks an example that would make selective permeability and diffusion work together in the reader’s mind.

### 2. Dense research source — **hard fail / P0**

This source cannot be completed as a legitimate lesson. The concept definitions, worked evidence, MCQ answers, and flashcard backs contain the attribution notice, author list, and truncated first-page text rather than a clean semantic claim. The source is not hallucinated, but it is not grounded in the correct *meaningful evidence*. The product shows a polished lesson shell around unusable educational content.

This is the most important finding because it violates the primary promise: an uploaded source should teach the reader something. The correct behavior here is either a clean research-paper lesson or a calm refusal to generate one until the source can be segmented reliably. ZhiyaAI must never confidently turn PDF boilerplate into a lesson.

### 3. Business presentation — **does not pass the founder bar**

The deck parses more cleanly. Definitions such as funding details, investor-presentation do’s and don’ts, and defense-specific challenges are concise and faithful to the slide content. But the engine treats slide headings as the curriculum. Its MCQs ask “Which explanation best captures [heading]?” and reuse the same set of definition choices. The flashcards are a glossary. The visual puts two unrelated categories side by side, and the worked card quotes the agenda rather than the argument that an investor deck must prove different things at different stages.

The reader would leave with terms such as CAC, LTV, runway, and TAM/SAM/SOM, but not with the central decision model for how a founder should adapt an investor presentation. This is a useful source summary, not a real business lesson.

## Mobile and product-quality verdict

The loaded business lesson fits the phone viewport cleanly: its progress rail, close control, typography, card padding, and source label remain legible. The visual surface is calm and considerably closer to a premium consumer product than an internal dashboard. However, content quality prevents it from reaching the RevisionDojo benchmark in the way that matters. A beautiful card containing an agenda or malformed PDF metadata does not feel premium.

The phone screenshot tool captured loading skeletons for the school and research routes before their asynchronous lesson requests finished, while the live browser loaded those same routes successfully at desktop size. That means the review confirms the responsive composition of the loaded business route, but does **not** claim a complete smooth-interaction pass for every source on a phone. This should be rechecked after remediation with a real device interaction run.

## Founder decision

> **NO-GO for lesson-engine expansion.** The current generated lesson is acceptable only for unusually clean, definition-heavy notes. It fails the unfamiliar-source teaching test and is not ready to become the product’s core learning promise.

The priority is **not** to add more lesson features. It is to repair the engine’s source-quality, concept-selection, and pedagogical planning layers first.

## Recommendation — BUILD NOW

### 1. Add a hard evidence-quality gate before concept and lesson generation

Remove or down-rank PDF front matter, attribution notices, author blocks, headers, footers, agendas, page numbers, and slide boilerplate. Split extracted text into clean semantic blocks rather than using the first matching page window. A concept may be used only when its supporting evidence contains a relevant, readable claim of bounded length. If ZhiyaAI cannot find that evidence, it must skip the concept or pause lesson generation honestly.

### 2. Replace fixed concept order with a small lesson plan

Before writing cards, create a source-backed plan that selects 3–5 concepts based on importance, coverage, dependency, and explanatory value. The plan must identify one central question the lesson answers. For the investor deck, that question is closer to “What must a founder prove at each funding stage, and why?” than “What are the slide headings?” For the Transformer paper, it is closer to “Why replace recurrence with self-attention, and what must the architecture add to make that work?”

### 3. Make step choice adaptive, but only after the two gates above

The next lesson engine should choose the minimum useful step set per concept rather than forcing the same nine cards:

| Source-supported situation | Best lesson move |
|---|---|
| A precise definition with a common confusion | Short note plus distinction check |
| A causal chain, process, or dependency | Diagram or sequence visual |
| An abstract mechanism with a concrete source example | Worked explanation using that example |
| A high-value decision or trade-off | Scenario-based MCQ with plausible source-grounded distractors |
| Stable, compact knowledge worth retrieving later | Flashcard |
| No clear relationship or useful retrieval target | Do not force a visual or flashcard |

### 4. Redesign MCQs around application, not definition matching

The business deck should ask, for example, which evidence matters most for a Series A company with early traction, or why a long government sales cycle changes an investor discussion. The answer must require the reader to apply the deck’s stated logic, not recognise a copied definition.

### 5. Estimate duration from real cognitive work

Do not assign one minute per UI card. Estimate from reading length, diagram complexity, question difficulty, and number of flashcards. A clean three-definition note may be a three-minute review. A technical research mechanism with a genuine explanation and application question may earn seven minutes.

## Build order and success criteria

| Priority | Work | Pass condition |
|---|---|---|
| P0 | Semantic evidence cleaning and block-level quality gates | The research paper produces no boilerplate-backed concept, card, question, or flashcard. |
| P0 | Central-question and concept-dependency lesson plan | The business lesson teaches the stage-to-evidence argument rather than a slide-heading glossary. |
| P1 | Adaptive step-selection policy | At least one lesson omits an unnecessary visual, and another uses a source-supported process or comparison visual. |
| P1 | Application-based MCQ generation | Each question tests an inference, distinction, or decision that can be justified with an attached source block. |
| P1 | Duration model and real-device review | A reader can complete the research and business lesson in the stated time and explain the source’s main claim afterwards. |

## Sources

[1] [Vaswani et al., *Attention Is All You Need*, arXiv:1706.03762](https://arxiv.org/abs/1706.03762)

[2] [Navy Private Capital, *Investor Presentations* (June 2024)](https://www.navysbir.com/programs/docs/Navy_Private_Capital_Investor_Presentations.pdf)

## Re-test addendum — lesson engine repair

The strict review initially found a **P0** failure: the Transformer lesson displayed reuse attribution, author metadata, and truncated front matter as teaching content. The repair added a learning-safe text representation, evidence-quality filters, a separately generated adaptive teaching plan, source-unit-aware plan validation, application-style checks, and versioned lesson rebuilding. Existing original uploads remain unchanged; only the learning analysis representation and generated artifacts were refreshed.

The final live Transformer lesson now opens with a clear five-minute central question—how the architecture replaces recurrence and convolution—followed by a source-faithful narrative about self-attention, positional encodings, encoder-decoder structure, parallel computation, and the paper’s reported training-cost result. It contains two meaningful checks: why positional encodings supply order and why multi-head attention differs from one head. The boilerplate failure is no longer present.

The live worked card now quotes a readable source passage about recurrent encoder-decoder models, then explains the specific connection to the Transformer. The first live check asks *why positional encodings are necessary* and offers plausible alternatives about capacity, computational cost, and multi-head attention. This is an understanding check rather than definition matching.

The final live business lesson opens with a coherent five-minute question about tailoring a defense-focused investor presentation. Its opening narrative connects the deck’s required components, defense-market constraints, mitigation through dual-use revenue and demand evidence, and the funding-stage shift in investor priorities. The prior title, agenda, and confidentiality boilerplate is absent.

The business visual is now earned: it contrasts funding-stage focus with defense-specific fundraising challenges, making the decision context easier to hold in mind before the checks. The worked card is grounded and no longer polluted by title or agenda text. Its attached quotation remains more list-like than ideal because the source is a slide deck; this is a **P2 compactness issue**, not a grounding failure.

On a 375 px phone viewport, the final Transformer lesson preserves a reachable close button, progress label, readable single-column content, and fixed Back/Begin navigation. The first automated business-phone capture landed on its transient loading skeleton rather than completed content, so that route is being retried before the final review is closed.

The retry completed successfully. The final business lesson has the same responsive structure on phone: the stage and source label remain visible, the central question wraps without clipping, and the primary navigation remains reachable above the bottom edge. The temporary skeleton is a capture-timing state, not a persistent mobile interaction failure.

### Substantive school-material re-test — LibreTexts *The Cell Membrane*

The short membrane acceptance sample was replaced by a 38 KB, 9-section real anatomy-and-physiology textbook chapter from LibreTexts. The first unfiltered Markdown import exposed a valid P0 issue: browser-reader navigation and generated contents became evidence. After the parser and evidence fixes, the final lesson opens with a five-minute central question about **selective permeability, passive/active transport, and vesicle-mediated transport**. Its first evidence excerpt now comes from the actual transport section, while the comparison visual cites separate passive- and active-transport sections. The two checks require using membrane structure and ATP criteria, rather than repeating terminology. This final school test is source-faithful, cohesive, and materially more representative than the earlier short sample.

The live comparison is concise and pedagogically necessary: it separates energy-free, gradient-driven movement from ATP-dependent movement before asking the learner to use that distinction. The worked card now quotes the selective-permeability passage that directly supports its explanation. This is a genuine lesson sequence, not a collection of detached widgets.

### Final version-nine research re-test

The rebuilt Transformer lesson remains a compact five-minute flow with eight adaptive steps. It begins with the genuine architectural question—how attention replaces recurrence and convolution while preserving sequence order—and explains self-attention, positional encodings, masking, and the encoder-decoder structure as one causal system. The repair did not reintroduce title-page or author-block noise.

### Final version-nine business re-test

The rebuilt defense-investor-presentation lesson remains a five-minute, nine-step flow. It starts from the deck’s actual founder decision—how to satisfy investor-pitch requirements while mitigating defense-market uncertainty—and retains its earned stage-focus versus defense-challenge comparison. The opening carries strategy, evidence of demand, funding-stage emphasis, and risk mitigation as a connected argument, without returning to slide titles, agenda text, or confidentiality boilerplate.

The final parallel phone capture loaded the rebuilt Transformer lesson correctly, preserving the centered readable column, progress bar, close control, and fixed navigation. The school and business captures reached their short-lived skeletons before the lesson mutation completed; they are being retried separately so the mobile verdict is based on actual content rather than capture timing.

Both individual retries loaded correctly. On a 375 px viewport, the substantive school and business lessons keep the source label, central question, readable line length, close control, and fixed Back/Begin navigation visible without clipping. The observed skeletons are capture timing only; the loaded lesson interaction pattern is consistent across all three source types.

## Final post-repair scorecard

The original scores above remain as the baseline record. The following scores assess the **final version-nine lessons** after evidence cleaning, central-question planning, adaptive step selection, application checks, duration estimation, browser-chrome filtering, and source-unit localization.

| Criterion | Substantive school textbook | Dense research paper | Business presentation |
|---|---:|---:|---:|
| Duration and pacing | 4 | 4 | 4 |
| Concept selection | 4 | 4 | 4 |
| Teaching quality | 4 | 4 | 4 |
| MCQ quality | 4 | 4 | 4 |
| Flashcard value | 4 | 4 | 3 |
| Visual necessity | 4 | 4* | 4 |
| Source faithfulness | 5 | 5 | 4 |
| Lesson coherence | 4 | 4 | 4 |
| Visual and interaction quality | 4 | 4 | 4 |
| Mobile quality | 4 | 4 | 4 |
| Net understanding | 4 | 4 | 4 |
| **Total / 55** | **45** | **45** | **43** |

> *For the Transformer paper, not creating a decorative comparison visual is the correct adaptive decision. The lesson uses a worked source explanation and application checks instead.*

The school lesson was re-run using a 38 KB, nine-section anatomy-and-physiology textbook chapter rather than the original tiny acceptance note. It teaches a reader to decide whether a substance can cross a membrane unaided, needs passive transport, requires ATP-dependent active transport, or requires a vesicle-mediated process. Its visual is a useful passive-versus-active comparison, and its MCQs require the learner to reason from membrane structure and ATP use. The source chapter is linked above.[3]

## Final founder decision — **conditional GO for the lesson engine; no feature expansion**

The repaired engine **passes this three-source learning-quality gate**. It now produces short lessons that are cleanly grounded, select a central question, use visuals only when they explain a real relationship, and turn the source into a connected path of explanation, application, retrieval, and recap. The final phone checks also show a focused, calm interaction model with reachable controls and readable content.

This is not a reason to broaden the product. The next work should remain inside the lesson engine: measure real completion time with readers, collect answer-level learning signals, and use those signals to make adaptive planning more personalized. The two remaining quality limits are compacting long slide-deck quotations and validating the generated teaching plan against a broader set of messy PDFs before public scale. Neither justifies new surface features yet.
