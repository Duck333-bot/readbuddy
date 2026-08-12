# ReadBuddy — Living Library Brand System

## 1. Decision

ReadBuddy should feel like **a living private library at twilight**. Outside reading, it is saturated, cinematic, and curious. Inside reading, it becomes quiet paper and ink. The connective tissue between both modes is a single proprietary motif: the **Living Thread**—a fine violet-to-sky path that appears when ReadBuddy connects a present sentence with an earlier idea.

> The product does not decorate intelligence. It makes intelligence visible as a path through a book.

## 2. Semantic color system

| Token | Hex | Role | Do not use for |
|---|---:|---|---|
| `ink` | `#131C38` | Primary ink, night hero, primary action | Body backgrounds in reader mode |
| `paper` | `#FFF9EF` | Warm luminous default product background | High-contrast action fill |
| `night` | `#08122E` | Deep immersive worlds and book-processing space | Ordinary cards |
| `violet` | `#6557E8` | AI intelligence, paths, interactive focus | Generic decoration |
| `sky` | `#46B8E8` | Retrieval, references, distant context | Main CTA |
| `sun` | `#FFD269` | Progress, invitation, book moment highlights | Long text |
| `coral` | `#F1786A` | Human warmth, selected reader moments | Error state |
| `mint` | `#5EC5A1` | Completion, ready state, successful processing | Decoration |

The application uses only semantic roles—`surface`, `surface-raised`, `text-primary`, `text-secondary`, `action-primary`, `ai`, `evidence`, `highlight`, `success`, and `danger`. Components never introduce new hex values. Saturation appears only at decision points, intelligence paths, and emotionally meaningful product moments.

## 3. Typography

| Role | Face | Use | Scale |
|---|---|---|---|
| Brand / Display | Fraunces | Landing thesis, book titles, library greetings | 72 / 56 / 40 / 32 / 24 |
| Interface | Inter | Navigation, controls, metadata, forms | 16 / 14 / 12 / 10 |
| Reading | Source Serif 4 | Book text, selected passages, evidence | 22 / 20 / 18 / 16 |

There are no ad-hoc type values. Labels are 10–12px uppercase with controlled tracking. Interface copy does not compete with book typography. Display text uses high contrast and sparse italics only for a meaningful phrase or title.

## 4. Form, spacing, and shadow

The shell is built around **three shapes only**: the book (`10px`), the object (`18px`), and the world (`32px`). Pills are reserved for compact states and filters, never used as a default escape hatch. Borders are hairline and low contrast. Shadows have one physical source: book objects lift down and slightly right; interfaces have no floating-card shadow unless they are deliberately interrupting attention.

Spacing follows an 8-point system: `8, 16, 24, 32, 48, 64, 96, 128`. Every screen has one dominant empty field. The absence of decoration is intentional space for a book, an idea, or a path to become visible.

## 5. Living Thread and icon language

The **Living Thread** begins as a small four-point star, then draws a thin line that arcs toward an earlier point. It can be a 1.5px violet line, a violet-to-sky gradient, or a quiet dotted route in dense contexts. It never runs continuously; it appears only to make a real connection. The symbol set derives from this geometry: a book-world mark (an open page crossed by one thread), a four-point spark for intelligence, a path loop for return, and an inset node for a remembered idea. Generic stock icons remain functional utilities only.

## 6. Motion grammar

| Motion | Duration | Job | Example |
|---|---:|---|---|
| Reveal | 420ms | Content enters a scene | Hero story step fades and rises |
| Lift | 180ms | A book becomes touchable | Cover lifts 6px on hover |
| Thread | 650ms | An intelligent connection becomes visible | Current idea traces to p.47 |
| Focus | 160ms | Reader attention narrows | Selection bar and answer settle in |

All motion is opacity and transform only, respects reduced motion, and is absent in long-form reading unless the reader actively requests help. No ambient bobbing, endless glows, or dashboard-like animated numbers.
