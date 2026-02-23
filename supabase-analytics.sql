-- supabase-analytics.sql
-- Creates the analytics_events table used by services/AnalyticsService.js
-- Run this migration in the Supabase SQL Editor
-- ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  text,
  event       text NOT NULL,
  properties  jsonb DEFAULT '{}',
  timestamp   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp
  ON analytics_events (timestamp DESC);

-- Index for per-user queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON analytics_events (user_id)
  WHERE user_id IS NOT NULL;

-- Index for event-type filtering
CREATE INDEX IF NOT EXISTS idx_analytics_events_event
  ON analytics_events (event);

-- RLS: users can only INSERT their own events, admins can SELECT all
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_insert_own
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY analytics_select_own
  ON analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- Optional: service-role bypass for dashboard queries
-- GRANT ALL ON analytics_events TO service_role;

COMMENT ON TABLE analytics_events IS 'Privacy-respecting analytics events flushed from the mobile client AnalyticsService';
