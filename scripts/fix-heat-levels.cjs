const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'content', 'prompts.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// ────────────────────────────────────────────────
// FIX 1: Deduplicate IDs for roleplay scenarios
// The second occurrence of h5_155-h5_166 (roleplay category, indices 686-697)
// needs unique IDs. Rename them to h5_rp_01 through h5_rp_12.
// ────────────────────────────────────────────────
const dupeRenames = {
  686: 'h5_rp_01',  // h5_155 dup → campsite roleplay
  687: 'h5_rp_02',  // h5_156 dup → mountain lake roleplay
  688: 'h5_rp_03',  // h5_157 dup → hot tub roleplay
  689: 'h5_rp_04',  // h5_158 dup → threesome roleplay
  690: 'h5_rp_05',  // h5_159 dup → therapist roleplay
  691: 'h5_rp_06',  // h5_160 dup → flight attendant roleplay
  692: 'h5_rp_07',  // h5_161 dup → hotel bar strangers roleplay
  693: 'h5_rp_08',  // h5_162 dup → yoga instructor roleplay
  694: 'h5_rp_09',  // h5_163 dup → cabin roleplay
  695: 'h5_rp_10',  // h5_164 dup → photographer roleplay
  696: 'h5_rp_11',  // h5_165 dup → masquerade roleplay
  697: 'h5_rp_12',  // h5_166 dup → massage therapist roleplay
};

let renameCount = 0;
Object.entries(dupeRenames).forEach(([idxStr, newId]) => {
  const idx = parseInt(idxStr);
  if (data.items[idx]) {
    const oldId = data.items[idx].id;
    data.items[idx].id = newId;
    console.log('  Renamed idx=' + idx + ': ' + oldId + ' -> ' + newId);
    renameCount++;
  }
});
console.log('Renamed ' + renameCount + ' duplicate IDs\n');

// ────────────────────────────────────────────────
// FIX 2: Restore roleplay scenarios to heat 5
// These are explicit roleplay scenarios that were incorrectly lowered
// ────────────────────────────────────────────────
const rpToHeat5 = ['h5_rp_03','h5_rp_04','h5_rp_05','h5_rp_06','h5_rp_07','h5_rp_08','h5_rp_09','h5_rp_10','h5_rp_11','h5_rp_12'];

let rpFixCount = 0;
data.items.forEach(item => {
  if (rpToHeat5.includes(item.id) && item.heat !== 5) {
    console.log('  ' + item.id + ': heat ' + item.heat + ' -> 5 | ' + item.text.substring(0, 80));
    item.heat = 5;
    rpFixCount++;
  }
});
console.log('Restored ' + rpFixCount + ' roleplay scenarios to heat 5\n');

// Update meta
data.meta.totalPrompts = data.items.length;

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

// Print final distribution
const counts = {};
data.items.forEach(p => { counts[p.heat] = (counts[p.heat] || 0) + 1; });
console.log('=== FINAL DISTRIBUTION ===');
Object.keys(counts).sort().forEach(h => {
  console.log('  Heat ' + h + ': ' + counts[h] + ' prompts');
});
console.log('  Total: ' + data.items.length);

// Verify no more duplicates
const idCheck = {};
data.items.forEach(p => { idCheck[p.id] = (idCheck[p.id] || 0) + 1; });
const remaining = Object.entries(idCheck).filter(([, c]) => c > 1);
console.log('\nRemaining duplicate IDs: ' + remaining.length);
if (remaining.length > 0) {
  remaining.forEach(([id, c]) => console.log('  ' + id + ': ' + c + 'x'));
}

console.log('\nFile saved successfully.');
