BEGIN;

CREATE TABLE IF NOT EXISTS public.password_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  last_sent_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT password_recovery_codes_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_codes_email
  ON public.password_recovery_codes (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_recovery_codes_user_id
  ON public.password_recovery_codes (user_id, created_at DESC);

ALTER TABLE public.password_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_recovery_codes_service_only ON public.password_recovery_codes;
CREATE POLICY password_recovery_codes_service_only
  ON public.password_recovery_codes
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;