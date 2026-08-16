# Design QA — Nearshore English

## Comparison target

- Source visual truth, home: `/Users/mieszko/Documents/Codex/2026-06-21/jad/work/chmurnik-reference/design/qa/current/chmurnik-home-desktop.png`
- Implementation, home: `/Users/mieszko/Documents/Codex/2026-08-16/files-pasted-by-the-user-b/work/nearshore-english-practice-studio-v7k3m9q2/design/qa/current/home-desktop.png`
- Source visual truth, lesson: `/Users/mieszko/Documents/Codex/2026-06-21/jad/work/chmurnik-reference/design/qa/current/lesson-desktop-top.png`
- Implementation, lesson: `/Users/mieszko/Documents/Codex/2026-08-16/files-pasted-by-the-user-b/work/nearshore-english-practice-studio-v7k3m9q2/design/qa/current/lesson-desktop.png`
- Additional source references: Chmurnik mobile home, mobile lesson top, recall and final-check screenshots plus the original tactile still-life asset.

## Normalization and state

- Home source and implementation: `1280 × 800` pixels, CSS viewport `1280 × 800`, density `1×`.
- Lesson source and implementation: `1440 × 900` pixels, CSS viewport `1440 × 900`, density `1×`.
- Theme: light.
- State: authenticated course home and beginning of a standard lesson. The implementation adapts the Chmurnik family rather than reproducing the cloud-learning content.
- Additional responsive check: CSS viewport `390 × 844`, course home and lesson 59.

## Full-view comparison evidence

The reference and implementation captures were opened together in the same comparison input at matching viewport sizes. The implementation preserves the visible design grammar of Chmurnik: pale pink field, olive interface accents, Romie display typography, Roobert controls and body copy, coral instructional labels, thin editorial rules, generous negative space, restrained buttons and tactile paper/felt imagery. The lesson hero retains the large serif title, oversized coral lesson number, restrained metadata and paper-like study surface.

The home layout is intentionally adapted from a centered Chmurnik message-and-art composition to a two-column recruiter-learning composition. This is an expected product adaptation: the generated headset, microphone, laptop and profile-card still life replaces the cloud-specific art while matching material, palette, crop and studio-lighting behavior.

## Focused region comparison evidence

No separate crop was needed. At native `1×` captures, the important regions — display typography, navigation, hero artwork, lesson number, metadata, progress rule and first lesson heading — are all large enough to judge directly. Generated imagery was also inspected separately at source resolution before placement; fibers, edges, shadows and crop remain clean without halos or upscaling artifacts.

## Required fidelity surfaces

- **Fonts and typography:** Passed. Exact Romie and Roobert font files from the user's Chmurnik reference are used. Display/body contrast, line height, optical weight, casing and lesson hierarchy match the family. Polish glyphs render correctly and mobile wrapping remains legible.
- **Spacing and layout rhythm:** Passed. Desktop and mobile preserve broad editorial breathing room, aligned page widths, strong section cadence and thin rules instead of generic card grids. No overlap, clipping or inaccessible persistent controls was observed.
- **Colors and visual tokens:** Passed. Pink, olive, ink, coral, paper, powder blue, plum and violet map coherently to the reference family. Semantic states remain distinguishable without introducing glossy effects or decorative gradients.
- **Image quality and asset fidelity:** Passed. Three purpose-made raster illustrations match the reference's tactile felt-and-paper still-life art direction. There are no placeholder images, emoji, custom inline SVG illustrations or CSS-drawn substitute assets. Phosphor provides the interface icon family.
- **Copy and content:** Passed. Polish instructional copy is concise and specific to spoken IT recruitment. English phrase packs are natural B2-level recruiter language. Privacy language accurately states that prompts are copied rather than sent.
- **Interactions and states:** Passed. Password error/success, navigation, lesson reveals, multiple choice, saving phrases, Again/Hard/Good, 18 cheat sheets, rescue accordion, prompt modal, clipboard copy and lesson 100 were exercised.
- **Accessibility:** Passed for the reviewed flow. Semantic headings and buttons, labels, alt text, visible keyboard focus, a skip link, practical mobile tap sizes and reduced-motion handling are present.

## Findings

No actionable P0, P1 or P2 differences remain.

- [P3] The desktop QA home capture shows a focus outline on the Start nav item after keyboard-safe navigation. This is an intentional accessibility state, not a visual defect; the idle state uses the same thin underline as the reference.

## Open questions

- None blocking. GitHub Pages can only provide a client-side password gate; this is appropriate for this non-confidential learning content, not for secrets or candidate data.

## Comparison history

- Pass 1: source and implementation compared at matching home and lesson viewports. No P0/P1/P2 issue found.
- A pre-pass copy check found doubled terminal punctuation in imported Polish goals. The parser was normalized before the final capture.
- Post-fix evidence: final home and lesson captures listed above; browser console check returned zero warnings and zero errors.

## Primary browser checks

- Password form unlocked the app with the configured passphrase.
- All 100 lesson rows rendered; lesson 100 rendered with six review phrases.
- Prompt modal created and copied a complete lesson-aware ChatGPT prompt.
- Good rating persisted completion and advanced the daily lesson.
- All 18 cheat-sheet entries rendered; rescue and My Phrases routes opened correctly.
- Mobile home and lesson layouts were checked at `390 × 844`.
- Console errors checked: none.

## Implementation checklist

- [x] Exact reference fonts and palette
- [x] Real generated tactile illustrations
- [x] Desktop and mobile responsive layouts
- [x] Core interaction path and local persistence
- [x] Content and production build checks
- [x] Password and privacy wording
- [x] GitHub Pages deployment configuration

final result: passed
