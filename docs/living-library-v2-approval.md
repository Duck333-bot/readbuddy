# ReadBuddy Living Library v2 — Approval Package

**Status:** Design-only. Production UI and feature work remain frozen until this package passes approval.

## What changed from v1

Living Library v2 keeps warm paper, deep ink, expressive outer product surfaces, a silent reader, a full-screen Book Brain moment, and the idea of knowledge connections. It removes the sense that ReadBuddy is a fantasy-literary themed startup. The product now has one proprietary visual behavior—the **ReadBuddy Thread**—and every screen proves the product before it creates atmosphere.

> **Product first. Brand world second. One connection behavior everywhere.**

## The ReadBuddy Thread

The thread is a fine violet-to-sky line with two endpoints and one job: make a real connection navigable. It may connect a current sentence to page 47, chapters to an emerging concept, or a current book to a remembered idea. It is absent when there is no relationship to show. Full rules are in [`living-library-v2-system.md`](./living-library-v2-system.md).

## Screen concepts

### Landing — value visible in three seconds

![Landing v2](/manus-storage/living-library-v2-landing_a3252a16.png)

The hero leads with the actual reading interaction: a difficult sentence, a compact annotation, and a thread to prior evidence. The headline promises, in plain language, that the reader will not get lost. Cinematic storytelling comes only after the product proof.

### Library — a private intellectual collection

![Library v2](/manus-storage/living-library-v2-library_47baabe1.png)

The library has one dominant recent journey and at most six large, gallery-like covers. Progress is quiet. Cover color can influence one contained journey field, but no cover floats or competes for attention. The screen is a personal collection, not a file-management dashboard.

### Upload / Book Brain — intelligence forming

![Upload v2](/manus-storage/living-library-v2-upload_8919b3a4.png)

Upload becomes a dedicated full-screen event. The book is shown becoming known: chapter structure, characters, concepts, connections, and spoiler boundaries form in front of the reader. Completion is personal: **“I’m ready to read with you.”**

### Reader — quiet editorial surface

![Reader v2](/manus-storage/living-library-v2-reader_4b5082aa.png)

The reading surface remains almost monochrome. The only notable signature is the tiny margin thread that links a current sentence to grounded earlier evidence. AI help stays annotation-like and local; it does not behave like a chat app.

## Interaction-state proof

### Desktop interaction sequence

![Desktop interaction states](/manus-storage/living-library-v2-interactions-desktop_a762deb8.png)

The desktop sequence proves the intended loop: library entry → book opens → Book Brain forms → reader selection → explanation → evidence jump → exact return → memory/recovery moments.

### Mobile interaction sequence

![Mobile interaction states](/manus-storage/living-library-v2-interactions-mobile_480024dc.png)

Mobile is not a compressed desktop. A touch-first bottom sheet appears only after selection; evidence connection and recovery states are designed as first-class one-handed flows.

## Required interaction states before implementation

| State | Visual behavior | Product proof |
|---|---|---|
| Library → open book | Cover becomes the current journey | Reading is the primary action |
| Upload → Book Brain | Chapters, people, concepts, and boundaries form | Whole-book understanding is real |
| Highlight → Explain | Focus motion, then local annotation | Help does not interrupt reading |
| Explain → evidence | Thread names prior page | Answer is grounded |
| Evidence → back | Prior source gains a brief focus state, then exact return | Context is navigable, not hand-wavy |
| Who? | Quiet entity memory, only to current spoiler boundary | Reader does not re-explain the book |
| I’m Lost | Compact orientation moment | The reader recovers without a chat detour |
| Resume tomorrow | Small recap and a return point | Reader memory is visible and useful |

## Approval scorecard

Approve only if every answer is **yes**.

| Gate | Yes / No |
|---|---|
| Would this be credible on a world-class consumer product launch? |  |
| Does it remain recognisable without the ReadBuddy wordmark? |  |
| Is it more premium and distinct than a generic AI notebook interface? |  |
| Does the landing make the book-level intelligence obvious immediately? |  |
| Does the upload moment make someone want to give it a book? |  |
| Does the library make someone want to continue reading? |  |
| Is the reader visibly calmer than the outer product surfaces? |  |
| Is AI intelligence obvious without a permanent chatbot sidebar? |  |
| Is the identity distinctive without gradients, decorative stars, or fantasy props? |  |
| Does mobile look intentionally designed rather than scaled down? |  |

## Implementation gate

Do **not** implement any production UI if two or more approval gates are “not really.” If approved, the build order is: semantic tokens → typography/spacing/shape primitives → thread mark → navigation shell → library → full-screen upload → landing → reader thread/annotation treatment → responsive polish and motion. No feature work should be mixed into that sequence.

**Decision requested:** approve V2, request a targeted revision, or choose a different concept before engineering resumes.
