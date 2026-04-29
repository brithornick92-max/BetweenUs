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

  test('account and couple deletion clean up private storage objects', () => {
    const productionSql = readRepoFile('database/supabase-production-setup.sql');
    const migrationSql = readRepoFile('supabase/migrations/20260429001000_cleanup_storage_on_account_delete.sql');

    expect(productionSql).toContain('CREATE OR REPLACE FUNCTION cleanup_couple_storage_objects');
    expect(productionSql).toContain("bucket_id = 'couple-media'");
    expect(productionSql).toContain("bucket_id IN ('attachments', 'whispers')");
    expect(productionSql).toContain('PERFORM cleanup_couple_storage_objects(_couple_id, auth.uid())');
    expect(productionSql).toContain('PERFORM cleanup_couple_storage_objects(the_couple_id, NULL)');

    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.cleanup_couple_storage_objects');
    expect(migrationSql).toContain('PERFORM public.cleanup_couple_storage_objects(_couple_id, auth.uid())');
  });

  test('Supabase auth session uses SecureStore before AsyncStorage fallback', () => {
    const supabaseConfig = readRepoFile('config/supabase.js');

    expect(supabaseConfig).toContain('import * as SecureStore from "expo-secure-store"');
    expect(supabaseConfig).toContain('SecureStore.getItemAsync(key)');
    expect(supabaseConfig).toContain('SecureStore.setItemAsync(key, value)');
    expect(supabaseConfig).toContain('SecureStore.deleteItemAsync(key)');
  });
});
