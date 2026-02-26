-- ============================================================================
-- Realtime + RLS fix: REPLICA IDENTITY FULL
-- ============================================================================
-- Supabase Realtime evaluates RLS policies on change events. For UPDATE and
-- DELETE events, Postgres only sends the columns in the replica identity by
-- default (just the primary key). RLS policies that reference other columns
-- (e.g., couple_id via couple_members join) will fail silently, causing the
-- event to be dropped for the subscriber.
--
-- Setting REPLICA IDENTITY FULL ensures the entire row is available in the
-- WAL for RLS evaluation on UPDATE/DELETE events.
--
-- Trade-off: slightly more WAL volume. For a couples app with low write
-- throughput, this is negligible.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE couple_data     REPLICA IDENTITY FULL;
ALTER TABLE calendar_events REPLICA IDENTITY FULL;
ALTER TABLE moments         REPLICA IDENTITY FULL;
ALTER TABLE couple_members  REPLICA IDENTITY FULL;
ALTER TABLE couples         REPLICA IDENTITY FULL;
