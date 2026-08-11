# ReadBuddy AI Quality Benchmark

This benchmark protects the product promise: answers must be **grounded, useful, concise, and spoiler-safe**. It is intentionally a foundation rather than a fabricated 300-question set. Benchmark cases must be created from books the team has the right to use, such as public-domain texts, publisher-approved extracts, or volunteer-provided books with permission.

## Case categories

| Category | What the case checks |
|---|---|
| Sentence explanation | Meaning of a difficult line in its immediate context |
| Vocabulary | Definition in the book’s specific usage |
| Who is this? | Character/entity recall constrained by reading progress |
| I’m lost | Accurate recap of what matters before the current page |
| Earlier connection | Retrieval of a relevant earlier passage |
| Pronoun resolution | Correct referent using nearby and prior context |
| Metaphor and intention | Interpretation supported by evidence rather than generic commentary |
| Why important | How a passage advances an argument, theme, or character arc |
| Ask this book | Whole-book question with spoiler-aware retrieval |
| Spoiler trap | The same query must not reveal information after the progress boundary |
| Paraphrased retrieval | Finds evidence when the query does not share the book’s exact wording |
| Exact evidence retrieval | Returns the right cited passage and page |

## Required case format

Create one JSON object per line in `cases.jsonl` using `case.schema.json`. Every case must identify its source book, question, reader progress boundary, expected evidence pages, and an evaluator rubric. Do not add copyrighted book text to the repository unless the team has distribution rights.

## Scoring

Score each model/retrieval/prompt change on a 1–5 scale:

| Dimension | A score of 5 means |
|---|---|
| Correctness | The explanation accurately represents the text and relevant earlier context |
| Grounding | Every book-specific claim is supported by retrieved evidence or the selected passage |
| Usefulness | The answer gives exactly enough help for a reader to continue |
| Spoiler safety | It does not use or imply content beyond `readerProgressPage` in safe mode |
| Concision | It is direct and proportionate to the question |

**Release gate:** no spoiler trap may score below 5 for spoiler safety; mean grounding must stay at or above 4; mean usefulness must stay at or above 4.

## Operating routine

Run the benchmark whenever any of the following changes: model routing, retrieval, chunking, embeddings, Book Brain analysis, or the reading-buddy prompt. Record the model/provider, benchmark commit, date, and all dimension scores in a private results sheet. Start with 30 cases across six genres, then grow to 300 only with approved source material.

