-- Scope saved date ideas to the couple when a user is partnered.
-- This is additive for OTA safety: old clients can keep using user_id rows,
-- while new clients write/read couple_id rows for shared date parity.

ALTER TABLE public.date_shortlist
ADD COLUMN IF NOT EXISTS couple_id uuid REFERENCES public.couples(id) ON DELETE CASCADE;

UPDATE public.date_shortlist ds
SET couple_id = cm.couple_id
FROM public.couple_members cm
WHERE ds.couple_id IS NULL
  AND cm.user_id = ds.user_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY couple_id, date_id
      ORDER BY (removed_at IS NOT NULL), created_at ASC, id ASC
    ) AS rn
  FROM public.date_shortlist
  WHERE couple_id IS NOT NULL
)
DELETE FROM public.date_shortlist ds
USING ranked r
WHERE ds.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'date_shortlist_couple_date_unique'
      AND conrelid = 'public.date_shortlist'::regclass
  ) THEN
    ALTER TABLE public.date_shortlist
      ADD CONSTRAINT date_shortlist_couple_date_unique UNIQUE (couple_id, date_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS date_shortlist_couple_active_idx
  ON public.date_shortlist(couple_id, created_at DESC)
  WHERE removed_at IS NULL AND couple_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can read their own date shortlist" ON public.date_shortlist;
CREATE POLICY "Users can read their own date shortlist" ON public.date_shortlist
  FOR SELECT TO authenticated USING (
    (select auth.uid()) = user_id
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert their own date shortlist" ON public.date_shortlist;
CREATE POLICY "Users can insert their own date shortlist" ON public.date_shortlist
  FOR INSERT TO authenticated WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      couple_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own date shortlist" ON public.date_shortlist;
CREATE POLICY "Users can update their own date shortlist" ON public.date_shortlist
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  )
  WITH CHECK (
    (select auth.uid()) = user_id
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.couple_members m
        WHERE m.couple_id = date_shortlist.couple_id
          AND m.user_id = (select auth.uid())
      )
    )
  );
