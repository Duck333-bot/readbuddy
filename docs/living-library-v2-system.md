# ReadBuddy Thread System — Living Library v2

## One signature behavior

The **ReadBuddy Thread** is a thin animated line that proves one specific connection. It always has two endpoints, a reason to exist, and a return path. It is not a background pattern, an ornamental divider, or an all-purpose star field.

| Product moment | Start | End | Reader value |
|---|---|---|---|
| Landing proof | Highlighted sentence | Earlier page label `p.47` | Understands whole-book context immediately |
| Upload | Chapter / entity / concept node | Connected book structure | Sees a book becoming known |
| Library | Current journey | One remembered concept or recent book | Feels the collection has continuity |
| Reader | Margin star at current passage | Earlier source passage | Verifies a grounded explanation |
| Resume | Yesterday’s page | Brief recap marker | Restarts without getting lost |

The thread uses `1.5px` weight, violet as its primary state, sky as its destination state, and a sun node only at a decisive moment. It moves once with a `650ms` Draw transition, then settles. In reduced-motion mode, it appears fully drawn with no tracing effect.

## Visual hierarchy v2

V2 is less atmospheric and more product-led. Each outer screen follows a confident sequence: **one product proof, one primary action, one visual field**. Warm paper is the neutral stage; midnight is used as a deliberate contrast object, not as a page wallpaper. Accent color is limited to an intelligence signal, a primary action, or a completion signal.

| Element | Final rule |
|---|---|
| Background | Paper or Night; no multi-color gradient field |
| Container | Invisible grouping by default; use a border only for product state, book object, or interruption |
| Radius | `10px` books, `18px` raised objects, `32px` world-scale stage; no arbitrary rounding |
| Shadow | Covers lift physically; information does not float by default |
| Illustration | Explain one product interaction or remain absent |
| Icon | Custom thread-derived mark for intelligence; utility icons stay quiet |
| Copy | Short, declarative, concrete; product mechanism before poetry |

## Typography and layout v2

Display type is bolder and less decorative. Headlines use Fraunces at high contrast and limited italic emphasis. Interface type uses Inter at a finite scale. Reading type uses Source Serif 4. Layouts are more asymmetric: the hero proof can occupy 55–65% of the scene while copy occupies the remaining column. Libraries present six or fewer covers at a time with substantial negative space. The reader stays almost monochrome.

## Explicit anti-patterns

Do not use a card grid to explain product value. Do not use stars, books, diagrams, or gradients unless they encode a real product relationship. Do not use a dialog for book ingestion. Do not use a permanent assistant panel in the reader. Do not use rounded borders and shadows as a substitute for hierarchy. The design should feel closer to an exacting consumer operating system with editorial depth than to a themed SaaS dashboard.
