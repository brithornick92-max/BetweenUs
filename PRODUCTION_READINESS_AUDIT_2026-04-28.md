# Between Us - Production Readiness Audit

**Original date:** 2026-04-28
**Current status update:** 2026-05-05

This file has been superseded by the current content-logic audit in
`CRITICAL_LOGIC_ISSUES.md` and `docs/PERSONALIZED_CONTENT_MODEL.md`.

## Current Content Release Status

The prior blocker about conflicting content-release systems is resolved.

- Prompts, dates, and sex positions now use the personalized weekly model from `WeeklyContentSetService`.
- Stable weekly allocations are persisted through `utils/stableWeeklyContent.js`.
- Content loading and storage routing no longer apply a separate release gate before the personalized allocation.
- Free users start with 20 prompts, 20 dates, and 5 sex positions.
- Premium users start with 100 prompts, 100 dates, and 10 sex positions from premium start.
- Weekly additions are cumulative and anchored to the user's own signup or premium-start date.

## Remaining Production Work

This historical audit also listed infrastructure and offline-sync concerns that should be tracked separately from the content-release model:

- Offline queue recovery and duplicate protection.
- Sentry breadcrumbs for high-value user flows.
- Platform build/QA verification beyond the current npm validation scripts.
- Store metadata and privacy-policy review.

Those items are not part of the current content logic gate.
