# Prompt Audit - 2026-05-05

Scope: `content/prompts.json` and prompt-focused audit rules in `scripts/audit-quality-tone.cjs`.

## Summary

- Added 263 draft conversation prompts across the requested thriving-couples, sensual, explicit, touch/connection, seasonal, playful, travel/location, roleplay, and shared-legacy sets.
- Pruned 394 weaker or redundant prompts across the full audit, including 344 in the broad final pass after the user approved pruning below 850 while keeping at least 650 and 25 more in the latest balancing pass.
- Prompt catalog now contains 749 prompts.
- New prompts span heat 1 through heat 5, with the final catalog preserving at least 125 prompts per heat level and at least 24 prompts in every category.
- Rewrote existing prompts that sounded cheesy, trivia-like, placeholder-based, or mechanically repetitive.
- Expanded the quality audit to block lightweight romantic cliches, `[X]` placeholder prompts, repeated `Tell me more` suffixes, closed ranking questions, and sexual euphemisms that should use direct language.

## Added Prompt Coverage

The new prompts cover light opinion-sharing, childhood beliefs, first-year memories, hand-holding imagination, hidden strengths, shared performance, fictional couple comparisons, bucket-list plans, lottery/dream-home/passion-project reflection, major-anniversary travel, private dreams not yet shared, changed beliefs, universe-level questions, defining life moments, consciousness after death, habit change, thriving-relationship definitions, post-draining-week care, growth versus acceptance, and recently moved-through fear or insecurity.

The deeper additions also cover shared values, life partnership, identity, major transitions, internal struggles, disappointment, emotional triggers, cultural norms, meaning, legacy, financial freedom, home as sanctuary, shared resources, wordless communication, emotional safety, authenticity, boundaries, fulfillment, and self-actualization.

The sensual and explicit additions cover sexual memories, anticipation, seduction, fantasies, dominance and submission, direct preferences, physical sensations, aftercare, emotional safety during sex, the emotional weight of touch, sex after stress, and the evolution of a couple's sex life.

The latest additions strengthen thin categories with seasonal rhythms, playful spontaneity, travel/location connection, more grounded roleplay scenarios, and shared-legacy prompts.

## Editorial Changes

- Replaced cutesy language such as `cute`, `adorable`, `butterflies`, `melts`, and `magical` with grounded emotional wording.
- Removed the placeholder prompt containing `[X]`.
- Rewrote closed ranking prompts into reflective prompts that invite context and story.
- Removed every prompt ending in `Tell me more`.
- Reworked the celebrity hall-pass prompt into a less gimmicky fantasy-reflection prompt.
- Fixed one explicit prompt with awkward grammar: `sensitive I'm to your touch`.
- Replaced sexual euphemisms such as `physical intimacy`, `being intimate`, `intimacy act`, and `intimacy session` in prompt text with direct phrasing such as `sex`, `have sex`, and `make love`.
- Updated user-facing labels that used `intimacy` as a sex euphemism, including `Keep intimacy alive`, `Make intimacy easier to start`, and `Morning intimacy / Night intimacy`.
- Removed weaker recent additions, including gimmicky fun prompts, grandiose abstraction, a private-video prompt, a forbidden/taboo prompt, and a near-duplicate kiss-memory prompt.
- Removed broad weak clusters across the full library: awkward grammar, sex euphemisms, off-theme trivia, over-scripted erotic scenarios, stock fantasy setups, mechanical duplicate sex prompts, repetitive `favorite way` prompts, and overrepresented emotional/physical prompts that did not open strong conversation.

## Audit Results

- `node scripts/audit-prompts.cjs`: 0 issues, 0 warnings.
- `node scripts/audit-quality-tone.cjs`: 0 blocking issues.
- `npm test -- --watchman=false --runTestsByPath __tests__/content/promptsCatalog.test.js __tests__/services/WeeklyContentSetService.test.js --runInBand`: 25 tests passed.
- Custom prompt tone sweep: 0 hits for cheesy/lightweight language, placeholder brackets, weak trivia, closed ranking, repeated `Tell me more`, `? Tell me more`, broken grammar patterns, over-scripted explicit phrasing, or sexual euphemisms that should be direct.

## Remaining Review-Only Notes

- `scripts/audit-quality-tone.cjs` still reports review-only prompt items: 4 low-heat `kinky` category prompts and 4 heat-5 memory prompts. These are category-label review notes, not blocking issues.
- `scripts/validateSemantics.cjs` still reports known keyword false positives, including lower-heat `kinky` category review items and broad category keyword checks. Its prompt-issue count is lower than before this pass because several rewritten prompts now satisfy its memory/future keyword checks.
