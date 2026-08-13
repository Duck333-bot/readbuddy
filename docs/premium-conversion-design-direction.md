# ReadBuddy Premium Conversion & Desirability Sprint — Design Direction

## Current audit

The current product is already **calm, literate, and coherent**, particularly in the reader, library, and account-entry screens. The main conversion weakness is not visual quality alone: the landing page states the promise but does not make the whole-book memory behavior feel undeniable before the first sign-in decision. The library feels warm, but its card grid still reads more as a product catalogue than a reader's personal intellectual space.

| Surface | Current strength | Conversion/design opportunity |
|---|---|---|
| Landing | Strong type, quiet palette, readable promise | Replace the generic product proof with a first-person “forgotten earlier passage” demonstration; lead visitors from a moment of reading confusion to grounded evidence. |
| Account entry | Polished split composition and clear Google action | Keep this intact; connect it more explicitly to the promise that the visitor has just seen. |
| Library | Real covers, clear continuation action, subdued information density | Add a more editorial sense of “the book currently in your hands” and elevate reader memory cues. |
| Upload | Correct non-blocking architecture and Book Brain stages | Frame progress as a quiet act of familiarisation, not a technical progress indicator. |
| Reader | Best existing product surface: quiet, evidence-aware, book-first | Preserve restraint; improve only hierarchy, states, and the felt precision of high-value moments. |

## Competitive principles used

The redesign uses **principles**, not visual copying. Framer's guidance supports a five-second value proposition, one primary conversion goal, real product proof rather than generic claims, and friction-reducing microcopy.[1] Figma's guidance emphasizes a focused hierarchy, intent-aligned product visuals, and a clear action above the fold.[2] RevisionDojo demonstrates the commercial power of showing the product in use and making its learning promise concrete, although ReadBuddy will not use fabricated social proof or borrow its visual language.[3]

## Original direction: **The remembered margin**

ReadBuddy will become an editorial reading environment built around one recognizable behavior: a subtle **margin thread** that appears only when the product remembers an earlier page. It is not decoration. It carries a reader from a difficult sentence to the smallest useful earlier passage.

The conversion story is therefore: **You encounter a difficult line → ReadBuddy recalls an earlier moment → You see the real page → You keep reading.**

### Tokens

| Role | Value | Use |
|---|---:|---|
| Deep Ink | `#0E1838` | Reading concentration, high-trust panels, text contrast |
| Warm Paper | `#FAF7EF` | Primary outside-reader surface |
| Thread Violet | `#7565E8` | Evidence, memory, focus, primary intelligence signal |
| Page Gold | `#F2C65B` | One reserved conversion/action cue |
| Marginal Blue | `#7D9FF2` | Secondary evidence / calm information cue |
| Quiet Ash | `#76798B` | Supporting copy and metadata |

**Typography:** Fraunces for thoughtful display statements; Source Serif 4 for reading; Inter for navigation, data, and controls.  
**Motion:** 160–260ms “lift” for controls; single thread-drawing reveal for evidence; no decorative ambient animation.  
**Layout:** outside the reader, editorial asymmetry and composed product proof; inside the reader, stable rhythm, short line length, and near-invisible chrome.

## Design decisions

1. The landing hero will show a real interaction state before feature explanation.
2. Product proof will contain four exact reading moments, not a feature-card grid.
3. Library and upload will use book-native labels, page edges, and margin annotations sparingly.
4. A pricing presentation can communicate paid value without inventing plans, billing, or testimonials.
5. Reader work is refinement, not a visual rewrite: attention stays on the book.

## References

[1]: https://www.framer.com/blog/landing-page-best-practices/ "Framer — Landing page best practices"
[2]: https://www.figma.com/resource-library/landing-page-examples/ "Figma — Landing page examples and tips"
[3]: https://www.revisiondojo.com/ "RevisionDojo — product marketing reference"
