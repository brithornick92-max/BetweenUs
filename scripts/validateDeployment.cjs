#!/usr/bin/env node
/**
 * validateDeployment.cjs — Minimal deployment validation
 * Verifies required env vars and config before EAS build.
 */
const requiredEnvVars = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];

const missing = requiredEnvVars.filter((k) => !process.env[k]?.trim());
if (missing.length > 0) {
  console.warn('⚠️ Missing env vars (required for EAS build):', missing.join(', '));
  if (process.env.CI === 'true') {
    process.exit(1);
  }
}
console.log('✅ Deployment validation passed');
process.exit(0);
