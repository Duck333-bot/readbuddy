# Upload hierarchy correction review

The refreshed captures confirmed that the corrected Book Terrain makes the book and its real milestones substantially larger than the earlier implementation. However, the first desktop review package also exposed that the dialog was still constrained by the base dialog component’s responsive `sm:max-w-lg` rule. This unintentionally limited the desktop dialog width, causing the remaining narrow headline line breaks and compressing both the book stage and functional paper stage.

The correction adds an explicit `sm:max-w-none` override to the Upload dialog. This restores the intended near-viewport desktop composition: the central book can remain dominant, the real milestones can organize around it, and filename, state, CTA, background progress, and recovery information receive adequate room. No processing or interaction behavior changed.
