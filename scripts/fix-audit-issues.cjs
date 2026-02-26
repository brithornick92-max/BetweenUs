const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'content', 'prompts.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let fixCount = 0;

// ============================================================================
// FIX 1: Add "roleplay" to meta.categories
// ============================================================================
if (!data.meta.categories.roleplay) {
  data.meta.categories.roleplay = 'Fantasy roleplay scenarios';
  fixCount++;
  console.log('FIX 1: Added "roleplay" to meta.categories');
}

// ============================================================================
// FIX 2: Add relationshipDuration to roleplay prompts (h5_rp_*)
// These are explicit roleplay scenarios → suitable for established+ relationships
// ============================================================================
data.items.forEach(p => {
  if (p.id.startsWith('h5_rp_') && !Array.isArray(p.relationshipDuration)) {
    p.relationshipDuration = ['established', 'mature', 'long_term'];
    fixCount++;
    console.log('FIX 2: Added relationshipDuration to ' + p.id);
  }
});

// ============================================================================
// FIX 3: Text quality fixes (typos and grammar)
// ============================================================================
const textFixes = {
  'h4_060': {
    old: 'What intimate experienceivity is most likely to make you orgasm...',
    new: 'What intimate experience is most likely to make you orgasm...',
    desc: 'typo: experienceivity → experience'
  },
  'h2_066': {
    old: 'How do you feel when I express yourself...',
    new: 'How do you feel when I express myself fully around you...',
    desc: 'grammar: express yourself → express myself fully around you'
  },
  'h2_067': {
    old: 'What sexy about being with someone who truly understands you...',
    new: "What's sexy about being with someone who truly understands you...",
    desc: "grammar: What sexy → What's sexy"
  },
  'h2_071': {
    old: 'What hottest about dating someone with your same anatomy...',
    new: "What's hottest about dating someone with your same anatomy...",
    desc: "grammar: What hottest → What's hottest"
  },
};

Object.entries(textFixes).forEach(([id, fix]) => {
  const p = data.items.find(i => i.id === id);
  if (p && p.text === fix.old) {
    p.text = fix.new;
    fixCount++;
    console.log('FIX 3: ' + id + ' — ' + fix.desc);
  } else if (p) {
    console.log('SKIP: ' + id + ' text does not match expected (may have been fixed already)');
  }
});

// ============================================================================
// FIX 4: Remove true duplicate — h5_rp_10 duplicates h5_073 (photographer roleplay)
// Keep h5_073 (the original), remove h5_rp_10
// ============================================================================
const rp10idx = data.items.findIndex(p => p.id === 'h5_rp_10');
if (rp10idx !== -1) {
  data.items.splice(rp10idx, 1);
  fixCount++;
  console.log('FIX 4: Removed h5_rp_10 (duplicate of h5_073 — photographer roleplay)');
}

// ============================================================================
// FIX 5: Rewrite near-duplicates to make them distinct
// ============================================================================
const rewrites = {
  // h5_048 too similar to h5_012 ("most passionate way...pleasure")
  'h5_048': {
    old: "What's the most passionate way you want me to pleasure you...",
    new: "Walk me through exactly how you want tonight to end — every position, every touch, every word...",
    desc: 'near-dupe of h5_012 → rewritten'
  },
  // h5_038 too similar to h5_014 ("Tell me how you want me to make love")
  'h5_038': {
    old: "Tell me how you want me to make love to you until you're deeply fulfilled.",
    new: "Describe the most intense lovemaking session you can imagine us having — from the first touch to the last breath...",
    desc: 'near-dupe of h5_014 → rewritten'
  },
  // h4_011 too similar to h4_003 ("adventurous and playful")
  'h4_011': {
    old: "What's something adventurous and playful you've been wanting to explore...",
    new: "If I told you we could try anything new tonight with zero judgment, what would you ask for...",
    desc: 'near-dupe of h4_003 → rewritten'
  },
  // h5_030 too similar to h5_012 ("most passionate way...make you")
  'h5_030': {
    old: "What's the most passionate way you want me to make you lose control completely...",
    new: "Tell me about a time you almost lost control with me — and what would push you completely over the edge...",
    desc: 'near-dupe of h5_012 → rewritten'
  },
};

Object.entries(rewrites).forEach(([id, rw]) => {
  const p = data.items.find(i => i.id === id);
  if (p && p.text === rw.old) {
    p.text = rw.new;
    fixCount++;
    console.log('FIX 5: ' + id + ' — ' + rw.desc);
  } else if (p) {
    console.log('SKIP: ' + id + ' text does not match expected');
  }
});

// ============================================================================
// FIX 6: Adjust heat levels for mild heat 5 prompts
// h5_034 "How do you want me to make you feel amazing" → heat 4 (too vague for 5)
// h5_074 "Do you want to touch each other at the same time" → heat 4 (suggestive but not graphic)
// ============================================================================
const heatDowngrades = {
  'h5_034': { to: 4, reason: 'too vague/mild for heat 5 — no explicit content' },
  'h5_074': { to: 4, reason: 'suggestive but not graphic — fits heat 4' },
};

Object.entries(heatDowngrades).forEach(([id, fix]) => {
  const p = data.items.find(i => i.id === id);
  if (p && p.heat !== fix.to) {
    console.log('FIX 6: ' + id + ': heat ' + p.heat + ' → ' + fix.to + ' (' + fix.reason + ')');
    p.heat = fix.to;
    fixCount++;
  }
});

// ============================================================================
// FIX 7: Renumber h5_rp IDs after removal of h5_rp_10
// ============================================================================
let rpNum = 1;
data.items.forEach(p => {
  if (p.id.startsWith('h5_rp_')) {
    const newId = 'h5_rp_' + String(rpNum).padStart(2, '0');
    if (p.id !== newId) {
      console.log('FIX 7: Renumbered ' + p.id + ' → ' + newId);
      p.id = newId;
      fixCount++;
    }
    rpNum++;
  }
});

// ============================================================================
// UPDATE META
// ============================================================================
data.meta.totalPrompts = data.items.length;

// ============================================================================
// SAVE
// ============================================================================
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

// ============================================================================
// FINAL VALIDATION
// ============================================================================
console.log('\n=== FINAL VALIDATION ===');
const heatCounts = {};
data.items.forEach(p => { heatCounts[p.heat] = (heatCounts[p.heat] || 0) + 1; });
Object.keys(heatCounts).sort().forEach(h => {
  console.log('  Heat ' + h + ': ' + heatCounts[h]);
});
console.log('  Total: ' + data.items.length + ' (meta: ' + data.meta.totalPrompts + ')');

// Verify no more duplicate IDs
const idCheck = {};
data.items.forEach(p => { idCheck[p.id] = (idCheck[p.id] || 0) + 1; });
const dupes = Object.entries(idCheck).filter(([, c]) => c > 1);
console.log('  Duplicate IDs: ' + dupes.length);

// Verify no missing relationshipDuration
const missingRD = data.items.filter(p => !Array.isArray(p.relationshipDuration));
console.log('  Missing relationshipDuration: ' + missingRD.length);

// Verify all categories are in meta
const allCats = [...new Set(data.items.map(p => p.category))];
const metaCats = Object.keys(data.meta.categories);
const unmappedCats = allCats.filter(c => !metaCats.includes(c));
console.log('  Unmapped categories: ' + unmappedCats.length + (unmappedCats.length ? ' (' + unmappedCats.join(', ') + ')' : ''));

console.log('\nTotal fixes applied: ' + fixCount);
console.log('File saved successfully.');
