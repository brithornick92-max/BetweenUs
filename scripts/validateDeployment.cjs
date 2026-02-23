#!/usr/bin/env node
/**
 * validateDeployment.cjs — Pre-build deployment validation
 * Verifies required env vars, assets, and config before EAS build.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── 1. Required environment variables ────────────────────────────
const requiredEnvVars = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
];

const recommendedEnvVars = [
];

let hasErrors = false;
const warnings = [];

const missingRequired = requiredEnvVars.filter((k) => !process.env[k]?.trim());
if (missingRequired.length > 0) {
  console.error('❌ Missing required env vars:', missingRequired.join(', '));
  hasErrors = true;
}

const missingRecommended = recommendedEnvVars.filter((k) => !process.env[k]?.trim());
if (missingRecommended.length > 0) {
  warnings.push(`⚠️  Missing recommended env vars (crash reporting disabled): ${missingRecommended.join(', ')}`);
}

// ─── 2. Required assets ───────────────────────────────────────────
const requiredAssets = ['assets/icon.png', 'assets/splash.png'];
for (const asset of requiredAssets) {
  const fullPath = path.join(ROOT, asset);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required asset: ${asset}`);
    hasErrors = true;
  }
}

// ─── 3. App config consistency ────────────────────────────────────
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  const expo = appJson.expo || {};

  // Check bundle identifiers are set
  if (!expo.ios?.bundleIdentifier) {
    console.error('❌ Missing ios.bundleIdentifier in app.json');
    hasErrors = true;
  }
  if (!expo.android?.package) {
    console.error('❌ Missing android.package in app.json');
    hasErrors = true;
  }

  // Check version is set
  if (!expo.version) {
    console.error('❌ Missing version in app.json');
    hasErrors = true;
  }

  // Check EAS project ID is set
  if (!expo.extra?.eas?.projectId) {
    console.error('❌ Missing eas.projectId in app.json extra');
    hasErrors = true;
  }

  // Check production build profile exists
  if (!easJson.build?.production) {
    warnings.push('⚠️  No production build profile in eas.json');
  }

  // Check icon and splash reference valid files
  if (expo.icon && !fs.existsSync(path.join(ROOT, expo.icon))) {
    console.error(`❌ app.json icon path does not exist: ${expo.icon}`);
    hasErrors = true;
  }
  if (expo.splash?.image && !fs.existsSync(path.join(ROOT, expo.splash.image))) {
    console.error(`❌ app.json splash image does not exist: ${expo.splash.image}`);
    hasErrors = true;
  }
} catch (e) {
  console.error('❌ Failed to read/parse config files:', e.message);
  hasErrors = true;
}

// ─── 4. Content files must exist and parse ────────────────────────
const contentFiles = ['content/dates.json', 'content/prompts.json'];
for (const cf of contentFiles) {
  const cfPath = path.join(ROOT, cf);
  if (!fs.existsSync(cfPath)) {
    console.error(`❌ Missing content file: ${cf}`);
    hasErrors = true;
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(cfPath, 'utf8'));
      const items = Array.isArray(data) ? data : data.items;
      if (!Array.isArray(items) || items.length === 0) {
        console.error(`❌ Content file ${cf} has no items`);
        hasErrors = true;
      }
    } catch (e) {
      console.error(`❌ Content file ${cf} is not valid JSON: ${e.message}`);
      hasErrors = true;
    }
  }
}

// ─── Output ───────────────────────────────────────────────────────
warnings.forEach(w => console.warn(w));

if (hasErrors) {
  console.error('\n❌ Deployment validation FAILED');
  if (process.env.CI === 'true') {
    process.exit(1);
  }
} else {
  console.log('✅ Deployment validation passed');
}
process.exit(hasErrors ? 1 : 0);
