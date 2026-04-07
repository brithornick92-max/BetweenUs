BEGIN;

CREATE TABLE IF NOT EXISTS public.password_recovery_request_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL,
  action text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_request_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT password_recovery_request_limits_request_count_check CHECK (request_count >= 0),
  CONSTRAINT password_recovery_request_limits_identifier_action_key UNIQUE (identifier_hash, action)
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_request_limits_updated_at
  ON public.password_recovery_request_limits (updated_at DESC);

ALTER TABLE public.password_recovery_request_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_recovery_request_limits_service_only ON public.password_recovery_request_limits;
CREATE POLICY password_recovery_request_limits_service_only
  ON public.password_recovery_request_limits
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;