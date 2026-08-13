# ReadBuddy Creative Direction Reset — Phase 0 Audit

## Scope and evidence

This audit reviews the deployed `sleepline.icu` experience and the current ReadBuddy product at public, authenticated, reader, and phone layouts. It is intentionally critical. It does not defend the current visual direction or recommend production changes before founder approval.

## Initial verdict

ReadBuddy’s current product is visually competent in isolated screens but **does not yet create a memorable visual world**. The warm paper, navy, serif, and violet system is coherent; it is also too familiar, too static, and too dependent on text to communicate intelligence. The product looks like a careful reading SaaS rather than an unmistakable reading companion with a point of view.

| Surface | What works | Why it still fails the desirability brief |
|---|---|---|
| Public landing | Concrete copy describes memory, evidence, and spoiler boundaries | It remains long-form feature explanation. The first visible moment does not create an emotional or visual “I need this” reaction. |
| Login | Clear Google entry and good information hierarchy | The navy/white split layout looks polished but generic. It proves restraint, not a distinctive company identity. |
| Library | Dune is foregrounded; book objects can feel personal | The grid quickly reverts to a data catalogue. Empty cover states and small metadata make it feel unfinished rather than tactile. |
| Reader | Quiet canvas, generous reading space, visible I’m Lost action | A slow or blank loading state leaves the reader looking like an empty document, which directly harms trust. The reading surface lacks a memorable margin behavior before interaction. |
| Mobile | Strong hierarchy and usable core controls | Navigation remains icon-heavy; the product story is not emotionally amplified for a small screen. |

## Why it can be read as boring, generic, or untrustworthy

The current system has consistent type and colors, but consistency is not art direction. Most surfaces rely on a pale background, a dark rectangle, a serif headline, small violet caps, and line icons. That is a recognizable contemporary product pattern, not a ReadBuddy-specific visual language. The current conversion story asks a visitor to read a large amount of copy before seeing a dramatic proof of memory in action.

The most damaging trust issue is the mismatch between the product name **ReadBuddy** and the public domain **sleepline.icu**. A visitor can reasonably question why a serious reading product is hosted under an unrelated name. This is an identity problem even when the application title itself says ReadBuddy. The current footer is also too small to carry privacy, support, company, or policy trust for a product that asks readers to upload personal books.

## Audit facts to carry into concepts

| Requirement | Implication for the direction review |
|---|---|
| Reading first, AI second | The reader must remain quiet. Emotion belongs mainly to marketing, onboarding, and Book Brain anticipation. |
| Evidence and spoiler safety are real differentiators | The hero should make one of these visible, not describe a generic AI assistant. |
| Young-user and adult-trust tests both matter | Art and motion need a real cognitive job; trust must come from identity, proof, privacy clarity, and realistic claims rather than fake social proof. |
| No production changes before approval | The next outputs are concept boards and a founder review only. |

## Responsive findings — 1440, 1280, and 1024

At wide desktop and laptop widths, the library is orderly but visually static: a large greeting, a navy continuation panel, then a regular cover grid. The cover art supplies more personality than the ReadBuddy interface itself. The system does not yet create a spatial feeling of collection, intellectual history, or memory. The 1024px view preserves legibility, but it scales the same composition rather than revealing a deliberate tablet narrative.

The reader is strongest when loaded: its typography, pale background, and wide white space communicate calm. However, its default loading state is visually empty for an extended moment and can read as a failed document. The design review must treat loading as part of the brand rather than a neutral technical state.

The authentication page is the most visually resolved existing surface: it has sensible hierarchy and a real privacy reassurance. Its weakness is category familiarity. The dark left panel plus white authentication card is a competent SaaS pattern, not a reading-specific emotional experience. A future direction should preserve its clarity while making the visual proof unmistakably about a reader, a book, and memory.

## Responsive findings — 430 and 390

The phone login view is tidy and legible, but it is almost entirely a white card and a Google button. It creates little emotional anticipation before the user authorizes access. The library handles its cover grid competently, though it feels like a miniaturized desktop collection rather than a mobile-native reading space. On the narrower 390px view, the header’s navigation density begins to compete with the greeting and the continuation object.

The loaded reader at 430px has excellent textual calm: a sparse page count, a narrow rule, large readable text, and evidence highlights that do not shout. At 390px, its loading skeleton dominates the capture. That contrast reinforces the need for a deliberate, book-native loading/arrival ritual in any future implementation. The visual concepts will therefore show loading and readiness as part of the product story rather than ignore them.

## Domain migration requirements — no DNS action taken

ReadBuddy should eventually move to a ReadBuddy-branded domain. Before any migration, prepare the following: choose and register a brand-matching domain; add it to hosting; update Google OAuth redirect URIs; verify the domain with the email provider; update canonical URLs, Open Graph metadata, favicon, sitemap, redirects, and legal/contact links; preserve the old domain as a redirect during transition; test sessions, cookie scope, upload URLs, and shared links. No domain purchase, DNS change, or redirect is authorized by this audit.

## Evidence informing the reset

The reset will deliberately separate **visceral, behavioral, and institutional** signals. Research on website first impressions indicates that people make fast aesthetic judgments that influence perceived relevance, credibility, and usability; NN/g also cautions that important actions must visibly look important rather than compete with irrelevant decoration.[1] The same source argues that a site should provide value before demanding sign-up, which supports a product demonstration before ReadBuddy asks a reader to create an account.[1]

Trust requires more than visual polish. NN/g identifies design quality, up-front disclosure, complete/current information, and connection to the rest of the web as enduring credibility factors.[2] A review of initial online trust similarly groups useful signals into visual design, social cues, and content/assurance signals.[3] ReadBuddy therefore needs real product proof, natural privacy/data clarity, a support path, and a brand-matching domain — not fake testimonials or invented scale.

## References

[1]: https://www.nngroup.com/articles/first-impressions-human-automaticity/ "First Impressions Matter: How Designers Can Support Humans’ Automatic Cognitive Processing — Nielsen Norman Group"
[2]: https://www.nngroup.com/articles/trustworthy-design/ "Trustworthiness in Web Design: 4 Credibility Factors — Nielsen Norman Group"
[3]: http://www.jecr.org/sites/default/files/12_4_p04.pdf "The Effect of Website Design Dimensions on Initial Trust — Journal of Electronic Commerce Research"
