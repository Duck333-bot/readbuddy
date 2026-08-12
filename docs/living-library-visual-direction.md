# ReadBuddy Living Library — Visual Direction v2

**Status:** Design-only. No further production UI or feature work should begin until this direction is approved.

## The decision

> **Books are worlds. Ideas form constellations. ReadBuddy remembers the paths between them.**

ReadBuddy is not a friendly pastel AI tool. It is a private intellectual world: cinematic and alive before a reader opens a book, then almost silent once they are inside one. The design must be recognisable through the **Living Thread** alone: an intelligent line that makes an otherwise invisible connection visible.

The latest implementation checkpoint is already on `main` and both configured remotes (`b836b86`). The design reset deliberately changes no production code beyond this planning package.

---

## Final system, in one table

| Layer | Direction | Rule |
|---|---|---|
| World | Luminous paper meeting midnight space | One dominant field per screen; avoid piles of cards |
| Color | Ink, Paper, Night, Violet, Sky, Sun, Coral, Mint | Semantic roles only; no local hard-coded colors |
| Type | Fraunces / Inter / Source Serif 4 | Display, interface, reading—exactly three roles |
| Shape | Book 10px, Object 18px, World 32px | Pills only for small states, never generic actions |
| Signature | Four-point star + Living Thread | Only appears for a genuine relationship, return path, or intelligence moment |
| Motion | Reveal, Lift, Thread, Focus | No ambient decoration or arbitrary hover behavior |

The complete token and motion specification lives in [`living-library-brand-system.md`](./living-library-brand-system.md). The visual philosophy that governs all of it lives in [`living-library-visual-philosophy.md`](./living-library-visual-philosophy.md).

---

## High-fidelity screen concepts

### 1. Landing — a world before a product explanation

![Landing concept](/manus-storage/living-library-landing-concept_91175330.png)

The page opens on one thesis, not a marketing deck: **“Read difficult books without getting lost.”** It immediately proves the central promise through an illustrated book world. A present sentence traces one thread to an earlier page, then the story quietly expands from a highlight to reader memory. There are no four-feature cards, generic screenshots, or “how it works” boxes.

| Desktop behavior | Mobile behavior | Acceptance test |
|---|---|---|
| Hero has a single large book-world field with a living thread | The same story becomes a vertical sequence with one clear CTA | A viewer understands “whole-book intelligence” before seeing a technical term |
| Story sections arrive as editorial scenes | Thread becomes an edge route between stacked scenes | Screenshot remains recognisable with the logo removed |

### 2. Library — an intellectual world, not records in a grid

![Library concept](/manus-storage/living-library-library-concept_e35bff03.png)

The library begins with a greeting and one dominant **Continue your journey** object. The reader’s most recent book has scale, cover gravity, chapter context, and one obvious action. The remaining collection is a shelf of physical covers with visual breathing room. A faint thread can connect recent reading history without turning the view into a dashboard.

| Desktop behavior | Mobile behavior | Acceptance test |
|---|---|---|
| One large recent-reading scene, then varied cover objects | Recent journey stays dominant; shelf becomes an intentional horizontal/stacked rhythm | It feels like entering a personal reading space, not a database |
| Cover colors lightly influence the journey object only | No dense metadata or tiny dashboard controls | Covers have room to breathe; no card borders around the shelf |

### 3. Upload / Book Brain — the product’s most magical promise

![Upload concept](/manus-storage/living-library-upload-concept_1df689d6.png)

Upload becomes a full-screen ritual called **Give ReadBuddy a book.** The reader sees the book become known: chapters form as a route, characters appear as points, concepts gather, then connections form. Completion does not say “upload successful”; it says **“I know this book now.”** Only then does **Start reading** appear.

| Desktop behavior | Mobile behavior | Acceptance test |
|---|---|---|
| Immersive stage with one tactile book and progressive diagram | Tall, cinematic step sequence with one action per stage | A 500-page upload feels more meaningful than a file transfer |
| The Living Thread joins actual processing states | Progress text stays human, never technical | No modal, dashed drop zone, or default progress-card appearance |

### 4. Reader — silence, plus one proof of intelligence

![Reader concept](/manus-storage/living-library-reader-concept_7770bcec.png)

The reader is mostly paper, ink, type, and space. The interface withdraws. The only unmistakable ReadBuddy signature is a tiny star and vertical **Living Thread** in the outer margin when a connection is real. It reaches an earlier page label; tapping it returns the reader to evidence. AI help is annotation-like and local, never a permanent assistant panel.

| Desktop behavior | Mobile behavior | Acceptance test |
|---|---|---|
| Quiet margin thread and page label beside a narrow reading column | Thread compresses into a subtle edge marker; selection actions appear in a bottom sheet | A long page can be read for ten minutes without visual interference |
| Help annotates the text rather than taking over it | One-handed actions remain clear after selection | A screenshot looks like a beautiful edition of a book, not an AI app |

---

## Visual rules that eliminate generic component-library leakage

1. **No default component appearance.** Radix/Shadcn may provide behavior, focus management, and accessibility, but every visual primitive must be restyled through the Living Library token system.
2. **No generic card grid.** A visible border earns its place only when it represents a book, a real interruption, or a specifically raised object.
3. **No blur blobs or decorative sparkles.** The star belongs only to an idea, a connection, or a processing node.
4. **No random rounded rectangles.** Use the three-shape system exactly.
5. **No technical copy in the reader journey.** Say “ReadBuddy remembers,” not “semantic retrieval completed.”

## Build handoff — only after approval

| Order | Work | Definition of done |
|---:|---|---|
| 1 | Replace global tokens and typography scale | No hard-coded product colors or arbitrary type scale remains |
| 2 | Add thread symbol and proprietary icon primitives | Every intelligence moment uses the same grammar |
| 3 | Rebuild navigation shell and library composition | No dashboard/grid-first feeling remains |
| 4 | Rebuild full-screen upload ritual | Book Brain feels like the product’s magical proof point |
| 5 | Rebuild landing as scroll story | Entire promise clear without generic feature cards |
| 6 | Apply reader margin-thread and quiet annotation treatment | Reading remains visually silent |
| 7 | Add responsive/motion/reduced-motion polish | Desktop and mobile remain the same world |

## Approval gate

Approve only if all statements below are true:

- **Ownable:** A screenshot without the wordmark still looks like ReadBuddy.
- **Coherent:** Landing, library, upload, and reader are visibly made by one design system.
- **Emotional:** The product makes a reader want to open a difficult book.
- **Clear:** Every screen has one obvious next action.
- **Invisible when necessary:** The reader gets out of the way of the book.

**Decision requested:** approve this direction, request a revision to the direction, or choose a different concept before any production UI work resumes.
