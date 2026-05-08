const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('backend security policy contracts', () => {
  test('profile writes never allow client-controlled premium status', () => {
    const cloudEngine = readRepoFile('services/storage/CloudEngine.js');

    expect(cloudEngine).toContain("const PROFILE_COLUMNS = ['email', 'display_name', 'preferences']");
    expect(cloudEngine).not.toContain("const PROFILE_COLUMNS = ['email', 'display_name', 'is_premium', 'preferences']");
  });

  test('premium checks use entitlements instead of profiles.is_premium', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260429000000_harden_profile_premium_status.sql');

    expect(productionSql).toContain('FROM user_entitlements ue');
    expect(productionSql).toContain('CREATE OR REPLACE FUNCTION guard_profile_premium_fields()');
    expect(productionSql).not.toContain('SELECT COALESCE((SELECT is_premium FROM profiles WHERE id = auth.uid()), false)');

    expect(migrationSql).toContain('FROM public.user_entitlements ue');
    expect(migrationSql).toContain('guard_profile_premium_fields_before_update');
  });

  test('trusted premium maintenance can refresh cached profile flags', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506190000_allow_profile_premium_maintenance.sql');
    const serviceRoleMigrationSql = readRepoFile('supabase/migrations/20260506200000_allow_service_role_premium_webhook.sql');
    const revenueCatHook = readRepoFile('supabase/functions/revenuecathook/index.ts');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain("current_setting('app.allow_profile_premium_update', true) = 'true'");
      expect(sql).toContain("set_config('app.allow_profile_premium_update', 'true', true)");
      expect(sql).toContain("profiles.is_premium is managed server-side");
      expect(sql).toContain('leave_couple');
    }

    for (const sql of [productionSql, migrationSql, serviceRoleMigrationSql]) {
      expect(sql).toContain("current_setting('app.allow_profile_premium_update', true) <> 'true'");
      expect(sql).toContain("couples.is_premium is managed server-side");
      expect(sql).toContain("auth.role() <> 'service_role'");
      expect(sql).toContain('CREATE OR REPLACE FUNCTION');
    }

    expect(revenueCatHook).toContain('coupleUpdateError');
    expect(revenueCatHook).toContain('Failed to update couple premium status');
  });

  test('account and couple deletion clean up private storage objects', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260429001000_cleanup_storage_on_account_delete.sql');
    const storageDeleteFixSql = readRepoFile('supabase/migrations/20260506220000_allow_storage_cleanup_helper_delete.sql');
    const accountDeletionSql = readRepoFile('supabase/migrations/20260508100000_harden_account_deletion_ownership.sql');

    for (const sql of [productionSql, migrationSql, storageDeleteFixSql]) {
      expect(sql).toContain('cleanup_couple_storage_objects');
      expect(sql).toContain("bucket_id = 'couple-media'");
      expect(sql).toContain("bucket_id IN ('attachments', 'whispers')");
    }

    for (const sql of [productionSql, storageDeleteFixSql]) {
      expect(sql).toContain("set_config('storage.allow_delete_query', 'true', true)");
      expect(sql).toContain("set_config('storage.allow_delete_query', COALESCE(previous_allow_delete, 'false'), true)");
    }

    expect(productionSql).toContain('PERFORM cleanup_couple_storage_objects(_couple_id, auth.uid())');
    expect(productionSql).toContain('PERFORM cleanup_couple_storage_objects(the_couple_id, NULL)');
    expect(productionSql).toContain('OR used_by = auth.uid()');
    expect(productionSql).toContain('DELETE FROM date_shortlist');

    expect(migrationSql).toContain('PERFORM public.cleanup_couple_storage_objects(_couple_id, auth.uid())');
    expect(accountDeletionSql).toContain('OR used_by = auth.uid()');
    expect(accountDeletionSql).toContain('DELETE FROM public.date_shortlist');
    expect(accountDeletionSql).toMatch(/REVOKE ALL ON FUNCTION public\.delete_own_account\(\) FROM PUBLIC, anon/);
  });

  test('prompt answers expose status but hide private text until server reveal', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260508110000_prompt_privacy_pairing_hardening.sql');
    const dataLayer = readRepoFile('services/data/SupabaseDataLayer.js');
    const revealScreen = readRepoFile('screens/RevealScreen.js');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('prompt_answer_status');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION');
      expect(sql).toContain('enforce_prompt_answer_privacy');
      expect(sql).toContain('sync_prompt_answer_status');
      expect(sql).toContain('CREATE OR REPLACE FUNCTION');
      expect(sql).toContain('reveal_prompt_answer');
      expect(sql).toContain('Partner has not answered yet');
      expect(sql).toContain("current_setting('app.allow_prompt_answer_reveal', true) = 'true'");
      expect(sql).toContain("NEW.is_private := true");
    }

    expect(dataLayer).toContain("dataType === 'prompt_answer' ? true");
    expect(dataLayer).toContain("sb.rpc('reveal_prompt_answer'");
    expect(dataLayer).toContain('partnerHasAnswered');
    expect(revealScreen).toContain('DataLayer.revealPromptAnswer');
  });

  test('couple reset does not silently replace active couples or leak attachment ownership', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260508110000_prompt_privacy_pairing_hardening.sql');
    const dataLayer = readRepoFile('services/data/SupabaseDataLayer.js');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('Leave your current couple before creating a new invite.');
      expect(sql).toMatch(/DELETE FROM (public\.)?date_shortlist WHERE user_id = ANY\(affected_member_ids\)/);
      expect(sql).toContain('get_partner_profile_summary');
      expect(sql).toContain("(storage.foldername(name))[2] = (select auth.uid())::text");
    }

    expect(dataLayer).toContain('attachments RLS policy requires path: {couple_id}/{user_id}/{file}');
    expect(dataLayer).toContain('`${coupleId}/${_userId}/${fileId}.${ext}`');
  });

  test('client account deletion delegates remote data removal to the Supabase RPC', () => {
    const authContext = readRepoFile('context/AuthContext.js');
    const deleteStart = authContext.indexOf('const deleteUserAccount = async () => {');
    const deleteEnd = authContext.indexOf('const value = useMemo', deleteStart);
    const deleteFlow = authContext.slice(deleteStart, deleteEnd);

    expect(deleteFlow).toContain('SupabaseAuthService.deleteAccount()');
    expect(deleteFlow).not.toContain('CloudEngine.deleteUserData()');
  });

  test('Supabase auth session uses SecureStore before AsyncStorage fallback', () => {
    const supabaseConfig = readRepoFile('config/supabase.js');

    expect(supabaseConfig).toContain('import * as SecureStore from "expo-secure-store"');
    expect(supabaseConfig).toContain('INSTALL_MARKER_KEY');
    expect(supabaseConfig).toContain('shouldIgnorePersistedAuthForFreshInstall');
    expect(supabaseConfig).toContain('SecureStore.getItemAsync(key)');
    expect(supabaseConfig).toContain('SecureStore.setItemAsync(key, value)');
    expect(supabaseConfig).toContain('SecureStore.deleteItemAsync(key)');
  });

  test('free calendar and date planning stay writable for couple members', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506120000_allow_free_calendar_and_date_plans.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain("'date_plan'");
      expect(sql).toContain('CREATE POLICY "Couple members can create calendar events"');
      expect(sql).toContain('CREATE POLICY "Couple members can update calendar events"');
      expect(sql).toContain('CREATE POLICY "Couple members can delete calendar events"');
    }

    const calendarStart = productionSql.indexOf('CREATE POLICY "Couple members can view calendar events"');
    const calendarEnd = productionSql.indexOf('CREATE POLICY "Couple members can view moments"', calendarStart);
    const productionCalendarPolicies = productionSql.slice(calendarStart, calendarEnd);

    expect(productionCalendarPolicies).not.toContain('couple_has_premium(calendar_events.couple_id)');
    expect(migrationSql).not.toContain('couple_has_premium(calendar_events.couple_id)');
  });

  test('Supabase audit hardening removes anonymous SECURITY DEFINER access', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506130000_supabase_audit_hardening.sql');
    const rpcSurfaceSql = readRepoFile('supabase/migrations/20260506140000_anonymous_auth_and_rpc_surface.sql');

    for (const sql of [productionSql, migrationSql, rpcSurfaceSql]) {
      expect(sql).toMatch(/REVOKE ALL ON FUNCTION (public\.)?notify_partner\(uuid, text, text, jsonb\) FROM PUBLIC, anon/);
    }

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toMatch(/REVOKE ALL ON FUNCTION (public\.)?notify_on_couple_data_insert\(\) FROM PUBLIC, anon, authenticated/);
    }

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
      expect(sql).toContain('experiments');
    }

    for (const sql of [productionSql, rpcSurfaceSql]) {
      expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION (public\.)?notify_partner\(uuid, text, text, jsonb\) TO authenticated/);
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION (public\.)?get_daily_usage_count[\s\S]*SECURITY INVOKER/);
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION (public\.)?delete_calendar_event_if_member[\s\S]*SECURITY INVOKER/);
    }
  });

  test('shared couple_data rows can be updated by either member without mutable identities', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506130000_supabase_audit_hardening.sql');
    const whisperPolicySql = readRepoFile('supabase/migrations/20260508090000_tighten_usage_and_whisper_policies.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('guard_couple_data_immutable_fields');
      expect(sql).toContain("'daily_prompt'");
      expect(sql).toContain("'daily_quiz'");
    }

    expect(migrationSql).toContain("data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan')");

    for (const sql of [productionSql, whisperPolicySql]) {
      expect(sql).toContain("data_type IN ('couple_state', 'daily_prompt', 'daily_quiz', 'date_plan', 'whisper')");
    }
  });

  test('usage events stay scoped to the authenticated user', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260508090000_tighten_usage_and_whisper_policies.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('input_user_id IS DISTINCT FROM auth.uid()');
      expect(sql).toContain('CREATE POLICY "Users can read own usage events"');
      expect(sql).toContain('user_id = (select auth.uid())');
      expect(sql).not.toContain('CREATE POLICY "Users can read couple usage events"');
    }
  });

  test('audit hardening keeps shared tables and media scoped to authenticated couple members', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506130000_supabase_audit_hardening.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('CREATE POLICY "Couple members can create calendar events"');
      expect(sql).toContain('CREATE POLICY "Couple members can update calendar events"');
      expect(sql).toContain('CREATE POLICY "Couple members can create moments"');
      expect(sql).toContain('CREATE POLICY storage_couple_media_member_insert');
      expect(sql).toContain('CREATE POLICY storage_couple_media_member_update');
      expect(sql).toContain('CREATE POLICY storage_couple_media_member_delete');

      const storageStart = sql.indexOf('CREATE POLICY storage_couple_media_member_select');
      const storageEnd = sql.indexOf('SECURITY DEFINER execution grants', storageStart);
      const storagePolicies = sql.slice(storageStart, storageEnd > storageStart ? storageEnd : undefined);

      expect(storagePolicies).toContain('TO authenticated');
      expect(storagePolicies).toContain('(select auth.uid())');
      expect(storagePolicies).not.toContain('WHERE cm.user_id = auth.uid()');
    }
  });

  test('private app tables reject Supabase anonymous-auth users', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506140000_anonymous_auth_and_rpc_surface.sql');
    const helperSql = readRepoFile('supabase/migrations/20260506170000_anonymous_auth_helper_policy.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toMatch(/CREATE POLICY block_anonymous_auth_users ON (public\.)?couple_data/);
      expect(sql).toMatch(/CREATE POLICY block_anonymous_auth_users ON (public\.)?calendar_events/);
      expect(sql).toMatch(/CREATE POLICY block_anonymous_auth_users ON (public\.)?moments/);
      expect(sql).toContain('CREATE POLICY block_anonymous_auth_users ON storage.objects');
      expect(sql).toContain('AS RESTRICTIVE FOR ALL TO authenticated');
      expect(sql).toContain("auth.jwt()->>'is_anonymous'");
    }

    for (const sql of [productionSql, helperSql]) {
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION (public\.)?is_permanent_authenticated_user/);
      expect(sql).toMatch(/\(select (public\.)?is_permanent_authenticated_user\(\)\)/);
    }
  });

  test('existing-couple pairing codes redeem into the stored couple', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506130000_supabase_audit_hardening.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain('IF code_row.couple_id IS NOT NULL THEN');
      expect(sql).toContain('target_couple_id := code_row.couple_id');
      expect(sql).toContain('This couple is already full');
      expect(sql).toContain('VALUES (target_couple_id, redeemer_id');
    }
  });

  test('partner activity notifications route to the right app surfaces', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506180000_partner_activity_notification_routes.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain("'type', 'journal_shared'");
      expect(sql).toContain("'route', 'journal'");
      expect(sql).toContain("'type', 'prompt_answered'");
      expect(sql).toContain("'route', 'prompt'");
      expect(sql).toContain("'type', 'memory_saved'");
      expect(sql).toContain("'route', 'our-story'");
    }
  });

  test('keepsake media posting can suppress intermediate partner notifications', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260506210000_fix_keepsake_media_posting.sql');

    for (const sql of [productionSql, migrationSql]) {
      expect(sql).toContain("NEW.value::jsonb->>'notifyPartner'");
      expect(sql).toContain("IN ('false', '0', 'no', 'off')");
      expect(sql).toContain("'video/mp4'");
      expect(sql).toContain("'application/octet-stream'");
    }
  });
});
