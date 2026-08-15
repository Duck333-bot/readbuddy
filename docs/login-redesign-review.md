# ZhiyaAI Login Redesign — Founder Review Record

## Implemented direction

The login and account-creation routes now use the founder-provided **centered authentication-card** direction: a quiet off-white field, a compact ZhiyaAI wordmark, one elevated white card, a large plain-language heading, a full-width provider action, a restrained divider, account-switch link, and a private-data note below the card.

The visual treatment intentionally differs from the former split-screen marketing layout. Authentication is now calm, focused, and fast to scan, while the ZhiyaAI wordmark and subtle lavender/gold atmospheric field retain product identity.

## Provider truthfulness

Only **Google** appears as an action because it is the only implemented sign-in provider. Apple, password, password-recovery, and email-link fields are deliberately absent; showing those controls would promise working flows that are not currently available. The card explicitly explains that Google uses a verified email and that ZhiyaAI does not use a password.

## Visual and interaction verification

The completed desktop render shows a centered 496 px card with balanced vertical space, clear hierarchy, an obvious Google control, and a calm privacy note. At 375 px wide, the card maintains readable line lengths, intact spacing, a full-width 48 px-plus primary action, visible account-switch link, and no clipped content. The Google route remains unchanged: `/api/auth/google/start` receives the active browser origin when the user activates the button.
