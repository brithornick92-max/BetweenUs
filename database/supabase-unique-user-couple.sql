-- ============================================================================
-- Migration: Enforce single-couple membership per user
-- ============================================================================
-- Adds a UNIQUE constraint on couple_members.user_id so a user cannot be
-- added to multiple couples via race conditions.
--
-- Pre-check: verify no duplicates exist before applying.
-- ============================================================================

-- 1. Diagnostic: find any existing duplicates (run first, fix manually if needed)
-- SELECT user_id, count(*) FROM couple_members GROUP BY user_id HAVING count(*) > 1;

-- 2. Add the constraint
ALTER TABLE couple_members
  ADD CONSTRAINT couple_members_user_id_unique UNIQUE (user_id);
