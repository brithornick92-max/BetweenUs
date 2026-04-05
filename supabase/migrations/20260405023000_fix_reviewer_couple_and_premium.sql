-- Repairs App Review tester state for:
--   betweenusreviewer1@outlook.com
--   betweenusreviewer2@outlook.com

BEGIN;

DO $$
DECLARE
  reviewer1_id uuid;
  reviewer2_id uuid;
  reviewer_couple_id uuid;
BEGIN
  SELECT id INTO reviewer1_id
  FROM auth.users
  WHERE lower(email) = 'betweenusreviewer1@outlook.com'
  LIMIT 1;

  SELECT id INTO reviewer2_id
  FROM auth.users
  WHERE lower(email) = 'betweenusreviewer2@outlook.com'
  LIMIT 1;

  IF reviewer1_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer 1 user not found: betweenusreviewer1@outlook.com';
  END IF;

  IF reviewer2_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer 2 user not found: betweenusreviewer2@outlook.com';
  END IF;

  DELETE FROM partner_link_codes
  WHERE created_by IN (reviewer1_id, reviewer2_id)
     OR used_by IN (reviewer1_id, reviewer2_id)
     OR couple_id IN (
       SELECT couple_id
       FROM couple_members
       WHERE user_id IN (reviewer1_id, reviewer2_id)
     );

  DELETE FROM couple_members
  WHERE user_id IN (reviewer1_id, reviewer2_id);

  DELETE FROM couples c
  WHERE c.id IN (
    SELECT c2.id
    FROM couples c2
    LEFT JOIN couple_members cm ON cm.couple_id = c2.id
    WHERE c2.created_by IN (reviewer1_id, reviewer2_id)
    GROUP BY c2.id
    HAVING count(cm.user_id) = 0
  );

  INSERT INTO couples (
    created_by,
    couple_name,
    is_active,
    is_premium,
    premium_since,
    premium_source,
    created_at,
    updated_at
  )
  VALUES (
    reviewer1_id,
    'App Review Couple',
    true,
    true,
    now(),
    reviewer1_id::text,
    now(),
    now()
  )
  RETURNING id INTO reviewer_couple_id;

  INSERT INTO couple_members (couple_id, user_id, role, created_at)
  VALUES
    (reviewer_couple_id, reviewer1_id, 'member', now()),
    (reviewer_couple_id, reviewer2_id, 'member', now());

  INSERT INTO user_entitlements (
    user_id,
    is_premium,
    entitlement_id,
    product_id,
    expires_at,
    updated_at,
    created_at
  )
  VALUES
    (reviewer1_id, true, 'app_review', 'manual_review_access', NULL, now(), now()),
    (reviewer2_id, true, 'app_review', 'manual_review_access', NULL, now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    is_premium = true,
    entitlement_id = EXCLUDED.entitlement_id,
    product_id = EXCLUDED.product_id,
    expires_at = NULL,
    updated_at = now();

  UPDATE profiles
  SET is_premium = true,
      updated_at = now()
  WHERE id IN (reviewer1_id, reviewer2_id);

  UPDATE couples
  SET is_premium = true,
      premium_since = COALESCE(premium_since, now()),
      premium_source = reviewer1_id::text,
      updated_at = now()
  WHERE id = reviewer_couple_id;
END $$;

COMMIT;