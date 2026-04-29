# Quality and Tone Audit - 2026-04-29

Scope: `content/prompts.json`, `content/dates.json`, and `content/intimacy-positions.json`.

## Summary

- Prompt catalog: 880 prompts. No structural blockers, duplicate text, low-heat explicit language, anatomy-specific wording, coercive wording, trivia drift, command-style prompts, yes/no openings, trailing ellipses, or missing final punctuation found by the current audits.
- Date catalog: 695 dates. Catalog integrity tests pass. No duplicate IDs/titles/step sequences, placeholder copy, gendered partner labels, low-heat explicit sexual wording, or known awkward naturalness phrases found by the focused audit.
- Sex positions catalog: 200 positions. Catalog integrity tests pass. No duplicate IDs/titles, generated-template phrases, gendered/anatomy-specific wording, coercive wording, high-risk impact wording, breath-play wording, or known awkward position phrases found by the focused audit.

## Copy Changes Made

- Replaced 758 prompt trailing ellipses with natural question marks or periods.
- Added obvious conversational contractions in prompts, like `I am` to `I'm` and `we are` to `we're`.
- Fixed imperative prompt punctuation such as `Tell me... ?` so those now read as statements.
- Rewrote a stricter set of stiff prompt phrases, including `crucial component`, `palpable`, `initiate intimacy`, awkward slash/parenthetical wording, and imperative prompts ending as questions.
- Smoothed date copy that sounded generated or overly editorial, including phrases like `embark on`, `immerse yourselves`, `amidst`, `personal perspective`, `real reminder`, `personal, personalized`, and repeated `This date is about...` framing. A later pass rewrote the remaining flagged setup paragraphs directly instead of just replacing phrases.
- Smoothed position copy with awkward phrases like `easy to stay inside`, `washed-in quality`, and `body feels held by the setup`.
- Reduced repeated position-card template language by replacing the `Many people like it because...` pattern across the catalog.
- Reduced AI-ish intensifiers in explicit prompts, including repeated `exactly`, `every detail`, `completely`, `most intense`, and `step by step` phrasing.
- Cleaned up mechanical rewrite artifacts in position copy, including patterns like `The draw is...`, `What works is...`, and `This can feel good when...` where they made sentences sound generated.

## Stricter Audit Notes

- `node scripts/audit-quality-tone.cjs` now gates additional naturalness issues: unfinished ellipses, missing punctuation, imperative prompts ending as questions, slash/shorthand wording, duplicate adjacent date words, awkward generated phrases, and repeated position-card templates.
- The script also gates mechanical rewrite artifacts in position copy, so the cleanup process itself cannot leave clumsy phrases behind.
- The stricter audit has 0 blocking issues after the copy pass.
- Remaining review-only items:
  - 7 low-heat `kinky` category prompts that read as light power dynamics or curiosity, not explicit BDSM.
  - 2 heat-5 `memory` prompts that are explicit but category-appropriate because the ask is about shared sexual memories.
  - 11 low-heat blindfold/trust/sensory date ideas remain review-only because their copy frames safety, guidance, taste, texture, or play.
  - 6 position comfort statements use absolute safety language like `never force`; these are appropriate safety/consent statements.

## Review Notes

- Existing `scripts/validateSemantics.cjs` reports 41 semantic issues, but most are keyword false positives:
  - `blindfold` appears in trust/sensory date ideas, not automatically sexual content.
  - `strip` appears in phrases like "scent strips", "arcade strip", and boardwalk/fair wording.
  - `domina` matches the beginning of "dominate" in a game-night prompt.
- Prompts have 147 legacy ID/heat prefix mismatches. This is expected and already encoded in `__tests__/content/promptsCatalog.test.js`; the runtime heat field is the source of truth.
- Prompts include 7 lower-heat `kinky` category items. Their copy reads as light power dynamics, boundaries, or curiosity rather than explicit BDSM. Consider whether the category label should mean "BDSM and power dynamics" exclusively, or be broadened to "power, edges, and adventurous trust."
- Prompts include 2 heat-5 `memory` prompts. They are explicit, but the category is defensible because the core ask is about shared sexual memories.
- Dates include 11 low-heat blindfold/trust/sensory ideas. The focused audit treats these as review-only because the copy frames safety, guidance, taste, texture, or play rather than explicit sexual activity.
- The position catalog uses 6 instances of absolute comfort language like "never force" or "always remain flexible." These are appropriate safety/consent statements, not product claims.
- `screens/IntimacyPositionsScreen.jsx` uses direct header copy: `SEX POSITIONS` for non-premium and `10 sex positions` for premium. This is clear and honest, but a softer option would be `Intimacy positions` if the product tone should feel less clinical/direct.

## Verification

- `node scripts/audit-prompts.cjs`: passed with 0 issues and 0 warnings.
- `node scripts/audit-quality-tone.cjs`: passed with 0 blocking issues.
- `npm test -- --watchman=false --runTestsByPath __tests__/content/promptsCatalog.test.js __tests__/content/datesCatalog.test.js __tests__/content/intimacyPositionsCatalog.test.js --runInBand`: 3 suites passed, 22 tests passed.

## Follow-Up Recommendations

- Update or replace `scripts/validateSemantics.cjs` before relying on it for release gating; it currently over-flags benign sensory/trust language.
- Decide whether prompt category metadata should be refined around `kinky` so low-heat adventurous prompts do not look misclassified during future audits.
