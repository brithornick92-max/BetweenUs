-- ============================================================================
-- supabase-rate-limiting.sql
-- Server-side rate limiting for Between Us
--
-- Uses a lightweight token-bucket table + helper function so RLS policies
-- and Edge Functions can enforce per-user request limits without external
-- infrastructure.
--
-- Requires: pg_cron (for periodic bucket refill)
-- ============================================================================

-- 1. Rate-limit bucket table
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens      INT NOT NULL DEFAULT 60,        -- current tokens available
  max_tokens  INT NOT NULL DEFAULT 60,        -- bucket capacity
  last_refill TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (only service_role should read/write directly)
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Service-role-only policy
CREATE POLICY "service_role_only" ON rate_limit_buckets
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Token-bucket check function
-- Returns TRUE if the request is allowed, FALSE if rate-limited.
-- Automatically refills tokens based on elapsed time (1 token per second, capped at max_tokens).
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_cost INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket rate_limit_buckets%ROWTYPE;
  v_elapsed INTERVAL;
  v_refill INT;
  v_new_tokens INT;
BEGIN
  -- Upsert: ensure bucket exists
  INSERT INTO rate_limit_buckets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock the row
  SELECT * INTO v_bucket
  FROM rate_limit_buckets
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Calculate refill based on time elapsed (1 token/sec)
  v_elapsed := now() - v_bucket.last_refill;
  v_refill := GREATEST(0, EXTRACT(EPOCH FROM v_elapsed)::INT);
  v_new_tokens := LEAST(v_bucket.max_tokens, v_bucket.tokens + v_refill);

  -- Check if enough tokens
  IF v_new_tokens < p_cost THEN
    -- Update refill time but deny
    UPDATE rate_limit_buckets
    SET tokens = v_new_tokens, last_refill = now()
    WHERE user_id = p_user_id;
    RETURN FALSE;
  END IF;

  -- Deduct tokens and allow
  UPDATE rate_limit_buckets
  SET tokens = v_new_tokens - p_cost,
      last_refill = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- 3. Stricter rate limit for sensitive operations (auth, pairing, code redemption)
-- Cost = 10 tokens per attempt, effectively 6 attempts per minute
CREATE OR REPLACE FUNCTION check_sensitive_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT check_rate_limit(p_user_id, 10);
$$;

-- 4. Apply rate limiting to code redemption
-- Wrap the existing redeem_partner_code function call behind a rate check.
-- Applications should call check_sensitive_rate_limit() before redeem_partner_code().
-- Example from client: SELECT check_sensitive_rate_limit(auth.uid()); then redeem.

-- 5. Cron job to reset stale buckets (every 5 minutes, refill all to max)
-- This provides a safety net in case the per-request refill misses.
SELECT cron.schedule('rate-limit-refill', '*/5 * * * *',
  $$UPDATE rate_limit_buckets SET tokens = max_tokens, last_refill = now() WHERE last_refill < now() - interval '5 minutes'$$
);

-- 6. Cron job to clean up buckets for deleted users (daily)
SELECT cron.schedule('rate-limit-cleanup', '0 3 * * *',
  $$DELETE FROM rate_limit_buckets WHERE user_id NOT IN (SELECT id FROM auth.users)$$
);

-- ✅ Rate limiting complete
-- • Token bucket: 60 tokens, 1/sec refill, burst capacity 60
-- • Sensitive ops: 10-token cost (6 per minute)
-- • check_rate_limit(user_id, cost) — general purpose
-- • check_sensitive_rate_limit(user_id) — for auth/pairing/redemption
-- • Periodic refill + cleanup via pg_cron
