const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'content', 'prompts.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const items = data.items;
const meta = data.meta;

const issues = [];
const warnings = [];

// ============================================================================
// 1. STRUCTURAL INTEGRITY
// ============================================================================
console.log('=== 1. STRUCTURAL INTEGRITY ===\n');

// Check meta.totalPrompts
if (meta.totalPrompts !== items.length) {
  issues.push(`meta.totalPrompts=${meta.totalPrompts} but actual=${items.length}`);
}
console.log(`Total prompts: ${items.length} (meta says ${meta.totalPrompts})`);

// Check for duplicate IDs
const idCounts = {};
items.forEach((p, idx) => {
  if (!idCounts[p.id]) idCounts[p.id] = [];
  idCounts[p.id].push(idx);
});
const dupes = Object.entries(idCounts).filter(([, v]) => v.length > 1);
if (dupes.length > 0) {
  dupes.forEach(([id, idxs]) => {
    issues.push(`DUPLICATE ID: ${id} at indices ${idxs.join(', ')}`);
  });
}
console.log(`Duplicate IDs: ${dupes.length}`);

// Check for missing required fields
const requiredFields = ['id', 'text', 'category', 'heat', 'relationshipDuration'];
let missingFieldCount = 0;
items.forEach((p, idx) => {
  requiredFields.forEach(f => {
    if (p[f] === undefined || p[f] === null) {
      issues.push(`idx=${idx} ${p.id || '???'}: missing field '${f}'`);
      missingFieldCount++;
    }
  });
});
console.log(`Missing required fields: ${missingFieldCount}`);

// Check for empty text
items.forEach((p, idx) => {
  if (typeof p.text === 'string' && p.text.trim().length === 0) {
    issues.push(`idx=${idx} ${p.id}: empty text`);
  }
});

// Check for very short text (< 15 chars)
items.forEach((p, idx) => {
  if (typeof p.text === 'string' && p.text.trim().length < 15) {
    warnings.push(`idx=${idx} ${p.id}: very short text (${p.text.trim().length} chars): "${p.text}"`);
  }
});

// ============================================================================
// 2. HEAT LEVEL VALIDATION
// ============================================================================
console.log('\n=== 2. HEAT LEVEL VALIDATION ===\n');

// Distribution
const heatCounts = {};
items.forEach(p => { heatCounts[p.heat] = (heatCounts[p.heat] || 0) + 1; });
Object.keys(heatCounts).sort().forEach(h => {
  console.log(`  Heat ${h}: ${heatCounts[h]} prompts`);
});

// Check for invalid heat values
items.forEach((p, idx) => {
  if (typeof p.heat !== 'number' || p.heat < 1 || p.heat > 5 || !Number.isInteger(p.heat)) {
    issues.push(`idx=${idx} ${p.id}: invalid heat value: ${p.heat}`);
  }
});

// ID prefix vs heat mismatch
const idHeatMismatches = [];
items.forEach((p, idx) => {
  const match = p.id.match(/^h(\d)/);
  if (match) {
    const idHeat = parseInt(match[1]);
    if (idHeat !== p.heat) {
      idHeatMismatches.push({ idx, id: p.id, idHeat, actualHeat: p.heat, text: p.text.substring(0, 80) });
    }
  }
});
console.log(`\nID/heat prefix mismatches: ${idHeatMismatches.length}`);

// ============================================================================
// 3. CATEGORY VALIDATION
// ============================================================================
console.log('\n=== 3. CATEGORY VALIDATION ===\n');

const validCategories = Object.keys(meta.categories);
const categoryCounts = {};
const invalidCategories = [];
items.forEach((p, idx) => {
  categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  if (!validCategories.includes(p.category) && p.category !== 'roleplay') {
    invalidCategories.push({ idx, id: p.id, category: p.category });
  }
});

Object.keys(categoryCounts).sort().forEach(c => {
  const valid = validCategories.includes(c) ? '' : ' ⚠️ NOT IN META';
  console.log(`  ${c}: ${categoryCounts[c]}${valid}`);
});

if (invalidCategories.length > 0) {
  warnings.push(`Categories not in meta.categories: ${[...new Set(invalidCategories.map(c => c.category))].join(', ')}`);
}

// ============================================================================
// 4. RELATIONSHIP DURATION VALIDATION
// ============================================================================
console.log('\n=== 4. RELATIONSHIP DURATION VALIDATION ===\n');

const validDurations = Object.keys(meta.relationshipDurations);
const durationCounts = {};
items.forEach((p, idx) => {
  if (!Array.isArray(p.relationshipDuration)) {
    issues.push(`idx=${idx} ${p.id}: relationshipDuration is not an array`);
    return;
  }
  if (p.relationshipDuration.length === 0) {
    warnings.push(`idx=${idx} ${p.id}: empty relationshipDuration array`);
  }
  p.relationshipDuration.forEach(d => {
    durationCounts[d] = (durationCounts[d] || 0) + 1;
    if (!validDurations.includes(d)) {
      issues.push(`idx=${idx} ${p.id}: invalid duration '${d}'`);
    }
  });
});

Object.keys(durationCounts).sort().forEach(d => {
  console.log(`  ${d}: ${durationCounts[d]}`);
});

// ============================================================================
// 5. CONTENT QUALITY CHECKS
// ============================================================================
console.log('\n=== 5. CONTENT QUALITY ===\n');

// Check for typos/incomplete words
const typoPatterns = [
  { regex: /\bintimateivity\b/i, desc: 'typo: intimateivity' },
  { regex: /\bexperienceivity\b/i, desc: 'typo: experienceivity' },
  { regex: /\byourself\b.*\byourself\b/i, desc: 'possible repeated word' },
  { regex: /\bwhat hottest\b/i, desc: 'grammar: missing word (What IS hottest)' },
  { regex: /\bwhat sexy\b/i, desc: 'grammar: missing word (What IS sexy)' },
  { regex: /\bexpress yourself\b/i, desc: 'possibly wrong: should be "express myself"?' },
  { regex: /\.\.\.\.\./i, desc: 'too many dots' },
  { regex: /\?\.\.\.$/i, desc: 'question mark followed by ellipsis' },
  { regex: /\s{2,}/g, desc: 'double spaces' },
  { regex: /^\s+/g, desc: 'leading whitespace' },
  { regex: /\s+$/g, desc: 'trailing whitespace (non-ellipsis)' },
  { regex: /\blove notes\b/i, desc: 'product term in prompt?' },
];

const textIssues = [];
items.forEach((p, idx) => {
  if (typeof p.text !== 'string') return;
  typoPatterns.forEach(({ regex, desc }) => {
    if (regex.test(p.text)) {
      textIssues.push({ idx, id: p.id, desc, text: p.text.substring(0, 100) });
    }
  });
  
  // Check for {partner} usage consistency (some use it, some don't)
  if (p.text.includes('{partner}')) {
    // This is fine, just tracking
  }
  
  // Check for dangling sentences / cut-off text
  if (p.text.length > 5 && !p.text.match(/[.?!…]$/) && !p.text.endsWith('...')) {
    // Ends without punctuation - might be cut off
    if (p.text.length > 100) {
      warnings.push(`idx=${idx} ${p.id}: long text ends without punctuation (may be truncated): "${p.text.substring(p.text.length - 40)}"`);
    }
  }
});

console.log(`Text quality issues: ${textIssues.length}`);
textIssues.forEach(t => {
  console.log(`  ${t.id}: ${t.desc}`);
  console.log(`    "${t.text}"`);
});

// ============================================================================
// 6. HEAT-CONTENT CROSS-CHECK (keyword analysis)
// ============================================================================
console.log('\n=== 6. HEAT-CONTENT CROSS-CHECK ===\n');

// Heat 1 should NOT contain sexual keywords
const sexualKeywords = /\bsex\b|\boral\b|\borgasm\b|\bclim[ax]/i;
const explicitKeywords = /\bpussy|cock\b|\bdick\b|\bnaked\b|\bnude\b|\bgenit|\bpenetr|\bblow.?job|\bfinger.*hole|\bsuck\b|\btaste.*you\b|\blick\b|\bgrind|\b69\b|\bscissor/i;
const steamyKeywords = /\bmasturbat|\btouch.*yourself|\bself-pleasure|\bstrip|\bdirty.*talk|\berogenous|\bforeplay|\bvibrat|\btoy[s]?\b|\bdildo|\boral\b|\borgasm/i;

// Heat 1 shouldn't have sexual content
const h1sexual = items.filter(p => p.heat === 1 && sexualKeywords.test(p.text));
if (h1sexual.length > 0) {
  console.log(`Heat 1 with sexual keywords: ${h1sexual.length}`);
  h1sexual.forEach(p => {
    issues.push(`HEAT 1 sexual content: ${p.id}: "${p.text.substring(0, 80)}"`);
    console.log(`  ${p.id}: ${p.text.substring(0, 80)}`);
  });
} else {
  console.log('Heat 1 with sexual keywords: 0 ✓');
}

// Heat 2 shouldn't have explicit content
const h2explicit = items.filter(p => p.heat === 2 && (explicitKeywords.test(p.text) || steamyKeywords.test(p.text)));
if (h2explicit.length > 0) {
  console.log(`Heat 2 with explicit/steamy keywords: ${h2explicit.length}`);
  h2explicit.forEach(p => {
    issues.push(`HEAT 2 explicit content: ${p.id}: "${p.text.substring(0, 80)}"`);
    console.log(`  ${p.id}: ${p.text.substring(0, 80)}`);
  });
} else {
  console.log('Heat 2 with explicit/steamy keywords: 0 ✓');
}

// Heat 3 shouldn't have explicit content
const h3explicit = items.filter(p => p.heat === 3 && explicitKeywords.test(p.text));
if (h3explicit.length > 0) {
  console.log(`Heat 3 with explicit keywords: ${h3explicit.length}`);
  h3explicit.forEach(p => {
    issues.push(`HEAT 3 explicit content: ${p.id}: "${p.text.substring(0, 80)}"`);
    console.log(`  ${p.id}: ${p.text.substring(0, 80)}`);
  });
} else {
  console.log('Heat 3 with explicit keywords: 0 ✓');
}

// Heat 5 that seems too mild
const mildKeywords = /^(what|how|when|where|who|which|do you|is there|tell me about|describe|if you could|imagine|have you ever)/i;
const h5mild = items.filter(p => p.heat === 5 && p.text.length < 60 && mildKeywords.test(p.text) && !explicitKeywords.test(p.text) && !steamyKeywords.test(p.text));
if (h5mild.length > 0) {
  console.log(`\nHeat 5 with potentially mild content (short + no explicit keywords): ${h5mild.length}`);
  h5mild.forEach(p => {
    warnings.push(`HEAT 5 may be too mild: ${p.id}: "${p.text}"`);
    console.log(`  ${p.id}: "${p.text}"`);
  });
}

// ============================================================================
// 7. SEQUENTIAL ID GAPS
// ============================================================================
console.log('\n=== 7. ID SEQUENCE GAPS ===\n');

for (let heat = 1; heat <= 5; heat++) {
  const prefix = `h${heat}_`;
  const nums = items
    .filter(p => p.id.startsWith(prefix))
    .map(p => parseInt(p.id.replace(prefix, '')))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  
  if (nums.length === 0) continue;
  
  const gaps = [];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i-1] > 1) {
      for (let g = nums[i-1] + 1; g < nums[i]; g++) {
        gaps.push(g);
      }
    }
  }
  
  console.log(`  h${heat}_: ${nums.length} prompts, range ${nums[0]}-${nums[nums.length-1]}, ${gaps.length} gaps`);
  if (gaps.length > 0 && gaps.length <= 10) {
    console.log(`    Missing: ${gaps.map(g => `h${heat}_${String(g).padStart(3, '0')}`).join(', ')}`);
  } else if (gaps.length > 10) {
    console.log(`    Missing (first 10): ${gaps.slice(0, 10).map(g => `h${heat}_${String(g).padStart(3, '0')}`).join(', ')} ...and ${gaps.length - 10} more`);
  }
}

// ============================================================================
// 8. DUPLICATE TEXT CHECK
// ============================================================================
console.log('\n=== 8. DUPLICATE / NEAR-DUPLICATE TEXT ===\n');

const textMap = {};
const exactDupes = [];
items.forEach((p, idx) => {
  const normalized = p.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (textMap[normalized]) {
    exactDupes.push({ id1: textMap[normalized].id, id2: p.id, text: p.text.substring(0, 80) });
  } else {
    textMap[normalized] = { id: p.id, idx };
  }
});

console.log(`Exact duplicate texts: ${exactDupes.length}`);
exactDupes.forEach(d => {
  issues.push(`DUPLICATE TEXT: ${d.id1} and ${d.id2}: "${d.text}"`);
  console.log(`  ${d.id1} = ${d.id2}: "${d.text}"`);
});

// Near-duplicates: same first 40 chars
const prefixMap = {};
const nearDupes = [];
items.forEach((p, idx) => {
  const prefix = p.text.toLowerCase().substring(0, 40).replace(/[^a-z0-9 ]/g, '').trim();
  if (prefixMap[prefix] && prefixMap[prefix].id !== p.id) {
    nearDupes.push({ id1: prefixMap[prefix].id, id2: p.id, text: p.text.substring(0, 80) });
  } else if (!prefixMap[prefix]) {
    prefixMap[prefix] = { id: p.id, idx };
  }
});

console.log(`Near-duplicate texts (same first 40 chars): ${nearDupes.length}`);
nearDupes.forEach(d => {
  console.log(`  ${d.id1} ~ ${d.id2}: "${d.text}"`);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log(`ISSUES (must fix): ${issues.length}`);
issues.forEach(i => console.log(`  ❌ ${i}`));
console.log(`\nWARNINGS (review): ${warnings.length}`);
warnings.forEach(w => console.log(`  ⚠️  ${w}`));
console.log('='.repeat(60));
