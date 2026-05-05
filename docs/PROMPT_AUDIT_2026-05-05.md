# Prompt Audit - 2026-05-05

Scope: `content/prompts.json` and prompt-focused audit rules in `scripts/audit-quality-tone.cjs`.

## Summary

- Added 123 conversation prompts that were missing or meaningfully under-covered from the requested thriving-couples set.
- Prompt catalog now contains 1003 prompts.
- New prompts span heat 1 through heat 5, with the largest additions in emotional, future, memory, and physical categories.
- Rewrote existing prompts that sounded cheesy, trivia-like, placeholder-based, or mechanically repetitive.
- Expanded the quality audit to block lightweight romantic cliches, `[X]` placeholder prompts, repeated `Tell me more` suffixes, and closed ranking questions.

## Added Prompt Coverage

The new prompts cover light opinion-sharing, childhood beliefs, first-year memories, hand-holding imagination, hidden strengths, shared performance, fictional couple comparisons, bucket-list plans, lottery/dream-home/passion-project reflection, major-anniversary travel, private dreams not yet shared, changed beliefs, universe-level questions, defining life moments, consciousness after death, habit change, thriving-relationship definitions, post-draining-week care, growth versus acceptance, and recently moved-through fear or insecurity.

## Editorial Changes

- Replaced cutesy language such as `cute`, `adorable`, `butterflies`, `melts`, and `magical` with grounded emotional wording.
- Removed the placeholder prompt containing `[X]`.
- Rewrote closed ranking prompts into reflective prompts that invite context and story.
- Removed every prompt ending in `Tell me more`.
- Reworked the celebrity hall-pass prompt into a less gimmicky fantasy-reflection prompt.
- Fixed one explicit prompt with awkward grammar: `sensitive I'm to your touch`.

## Audit Results

- `node scripts/audit-prompts.cjs`: 0 issues, 0 warnings.
- `node scripts/audit-quality-tone.cjs`: 0 blocking issues.
- Custom prompt tone sweep: 0 hits for cheesy/lightweight language, placeholder brackets, weak trivia, closed ranking, repeated `Tell me more`, or `? Tell me more`.

## Remaining Review-Only Notes

- `scripts/audit-quality-tone.cjs` still reports review-only items already documented in the previous audit: 7 low-heat `kinky` category prompts and 2 heat-5 memory prompts.
- `scripts/validateSemantics.cjs` still reports known keyword false positives, including lower-heat `kinky` category review items and broad category keyword checks. Its prompt-issue count is lower than before this pass because several rewritten prompts now satisfy its memory/future keyword checks.
