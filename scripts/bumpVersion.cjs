/**
 * bumpVersion.cjs — Bumps expo.version in app.json (semver)
 *
 * Usage:
 *   node scripts/bumpVersion.cjs patch   →  1.0.17 → 1.0.18
 *   node scripts/bumpVersion.cjs minor   →  1.0.17 → 1.1.0
 *   node scripts/bumpVersion.cjs major   →  1.0.17 → 2.0.0
 *
 * Build numbers (ios.buildNumber / android.versionCode) are handled
 * automatically by EAS Build via "autoIncrement": true in eas.json.
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '..', 'app.json');
const bump = process.argv[2];

if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: node scripts/bumpVersion.cjs <patch|minor|major>');
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const current = appJson.expo.version;
const [major, minor, patch] = current.split('.').map(Number);

let next;
if (bump === 'major') next = `${major + 1}.0.0`;
else if (bump === 'minor') next = `${major}.${minor + 1}.0`;
else next = `${major}.${minor}.${patch + 1}`;

appJson.expo.version = next;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n', 'utf8');

console.log(`✅ ${current} → ${next}`);
