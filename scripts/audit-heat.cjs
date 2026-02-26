// Audit every prompt's heat level against its actual content
const data = require('../content/prompts.json');
const items = data.items;

console.log('Total:', items.length);

// Distribution
const byHeat = {};
items.forEach(p => { byHeat[p.heat] = (byHeat[p.heat] || 0) + 1; });
console.log('Heat distribution:', JSON.stringify(byHeat));

// Show samples from each heat level
for (let h = 1; h <= 5; h++) {
  const group = items.filter(p => p.heat === h);
  console.log(`\n=== HEAT ${h} (${group.length} prompts) — first 10 ===`);
  group.slice(0, 10).forEach(p =>
    console.log(`  ${p.id} | ${p.category} | ${p.text.substring(0, 100)}`)
  );
  console.log(`  ... last 5 ...`);
  group.slice(-5).forEach(p =>
    console.log(`  ${p.id} | ${p.category} | ${p.text.substring(0, 100)}`)
  );
}

// Flag potential misassignments
const SEXUAL_KEYWORDS = [
  'sex', 'orgasm', 'climax', 'naked', 'nude', 'strip', 'moan',
  'lick', 'suck', 'thrust', 'grind', 'straddle', 'erotic', 'kinky',
  'foreplay', 'lingerie', 'undress', 'make love', 'tongue',
  'position', 'cowgirl', 'doggy', 'missionary', 'submissive', 'dominant',
  'blindfold', 'handcuff', 'rope', 'dirty', 'filthy', 'naughty',
  'pleasure yourself', 'masturbat', 'vibrat', 'toy', 'oral',
  'penetrat', 'spank', 'edge', 'edging',
];
const MILD_KEYWORDS = [
  'cuddle', 'snuggle', 'favorite', 'smile', 'laugh', 'memory',
  'dream', 'hope', 'grateful', 'appreciate', 'childhood', 'family',
  'friend', 'morning', 'coffee', 'food', 'movie', 'song',
];

console.log('\n=== POTENTIAL MISASSIGNMENTS ===');

// Explicit content at low heat
console.log('\n--- Explicit content at heat 1-2 ---');
items.filter(p => p.heat <= 2).forEach(p => {
  const t = p.text.toLowerCase();
  const hits = SEXUAL_KEYWORDS.filter(kw => t.includes(kw));
  if (hits.length >= 2) {
    console.log(`  ⚠️ ${p.id} heat=${p.heat} hits=[${hits.join(',')}] | ${p.text.substring(0, 100)}`);
  }
});

// Very mild content at heat 4-5
console.log('\n--- Very mild content at heat 4-5 ---');
items.filter(p => p.heat >= 4).forEach(p => {
  const t = p.text.toLowerCase();
  const sexHits = SEXUAL_KEYWORDS.filter(kw => t.includes(kw));
  const mildHits = MILD_KEYWORDS.filter(kw => t.includes(kw));
  if (sexHits.length === 0 && mildHits.length >= 3) {
    console.log(`  ⚠️ ${p.id} heat=${p.heat} mildHits=[${mildHits.join(',')}] | ${p.text.substring(0, 100)}`);
  }
});

// Check for any missing or invalid heat values
console.log('\n--- Invalid heat values ---');
items.forEach(p => {
  if (typeof p.heat !== 'number' || p.heat < 1 || p.heat > 5) {
    console.log(`  ❌ ${p.id} heat=${p.heat}`);
  }
});
