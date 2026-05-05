# Critical Logic Audit

Last updated: 2026-05-05

## Content Release Logic

**Status:** Resolved.

The app now uses one content-release model for prompts, date ideas, and sex positions:

- `WeeklyContentSetService` calculates the user's personal week from the correct anchor.
- `stableWeeklyContent` stores the user's weekly allocation so boundary changes do not backfill extra cards during the same week.
- Content loaders return the full eligible catalog; they do not apply a separate global release gate first.
- Detail screens use stable weekly deck membership before showing a premium upsell for cards outside the user's current allocation.

## Current Product Contract

Free users:

- Week 0 from signup: 20 prompts, 20 dates, 5 sex positions.
- Each personal week after signup: +5 prompts, +5 dates, +1 sex position.
- Calendar, journal, prompt answers, sync, and heartbeat remain available on the free tier.
- Keepsake history is limited to the most recent month.

Premium users:

- Week 0 from premium start: 100 prompts, 100 dates, 10 sex positions.
- Each personal week after premium start: +15 prompts, +15 dates, +3 sex positions.
- Full Keepsake history and Vibe Signal are premium.

## Boundary Behavior

Boundary changes are intentionally conservative:

- Tightening boundaries hides cards above the new boundary immediately.
- Loosening boundaries during the same week does not add replacement cards.
- The next personal week rebuilds the allocation from the currently eligible pool and adds the correct number of new cards.
- Completed cards stay out of the active deck unless the user long-presses to restore them.

## Verification

- Live app paths no longer import the removed legacy scheduler.
- The old fixed free-preview prompt pack is disabled.
- The deprecated global-week helper has been removed from `WeeklyContentSetService`.
- Tracked backup and stale generated content artifacts have been removed from source folders.
- Automated coverage includes weekly count growth, premium anchors, stable boundary allocations, and direct detail-screen access checks.
