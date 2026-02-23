const data = require('../content/dates.json');

let errors = 0;

// 1. Check duplicate IDs
const ids = new Set();
data.items.forEach(item => {
  if (ids.has(item.id)) { console.error('DUPLICATE ID:', item.id); errors++; }
  ids.add(item.id);
});

// 2. Check duplicate titles (exact)
const titles = new Set();
data.items.forEach(item => {
  if (titles.has(item.title)) { console.error('DUPLICATE TITLE:', item.title); errors++; }
  titles.add(item.title);
});

// 3. Check near-duplicate titles (normalized)
const normalize = (t) => t.toLowerCase()
  .replace(/couples?\s*/g, '')
  .replace(/\b(the|a|an|and|in|at|on|for|of|with|to|night|date|session|experience|adventure|workshop|class|lesson)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizedMap = {};
data.items.forEach(item => {
  const norm = normalize(item.title);
  if (!normalizedMap[norm]) normalizedMap[norm] = [];
  normalizedMap[norm].push(item);
});

console.log('\n=== NEAR-DUPLICATE TITLES (same after normalization) ===');
let nearDupes = 0;
Object.entries(normalizedMap).forEach(([norm, items]) => {
  if (items.length > 1) {
    nearDupes++;
    console.log('  "' + norm + '":');
    items.forEach(i => console.log('    ' + i.id + ': ' + i.title + ' [heat' + i.heat + '/load' + i.load + '/' + i.style + ']'));
  }
});
if (nearDupes === 0) console.log('  None found.');

// 4. Check conceptually similar (same first 2 words + same energy+depth)
console.log('\n=== SIMILAR CONCEPTS (same key words + same dimensions) ===');
const conceptMap = {};
data.items.forEach(item => {
  const words = item.title.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i+1];
    const key = bigram + '|' + item.heat + '|' + item.load;
    if (!conceptMap[key]) conceptMap[key] = [];
    conceptMap[key].push(item);
  }
});

let conceptDupes = 0;
Object.entries(conceptMap).forEach(([key, items]) => {
  if (items.length > 1) {
    const parts = key.split('|');
    const bigram = parts[0];
    if (['each other', 'for each', 'take turns', 'share what', 'end with'].includes(bigram)) return;
    conceptDupes++;
    console.log('  "' + bigram + '" [' + parts[1] + '/' + parts[2] + ']:');
    items.forEach(i => console.log('    ' + i.id + ': ' + i.title));
  }
});
if (conceptDupes === 0) console.log('  None found.');

// 5. Check for very similar first steps (same energy+depth)
console.log('\n=== SIMILAR FIRST STEPS (same dimensions) ===');
const stepMap = {};
data.items.forEach(item => {
  const key = item.steps[0].toLowerCase().trim() + '|' + item.heat + '|' + item.load;
  if (!stepMap[key]) stepMap[key] = [];
  stepMap[key].push(item);
});

let stepDupes = 0;
Object.entries(stepMap).forEach(([key, items]) => {
  if (items.length > 1) {
    stepDupes++;
    const step = key.split('|')[0];
    console.log('  Step: "' + step + '"');
    items.forEach(i => console.log('    ' + i.id + ': ' + i.title + ' [heat' + i.heat + '/load' + i.load + ']'));
  }
});
if (stepDupes === 0) console.log('  None found.');

// 6. Dimension field validation
console.log('\n=== DIMENSION VALIDATION ===');
const VALID_STYLE = ['talking', 'doing', 'mixed'];
let dimErrors = 0;
data.items.forEach(item => {
  if (typeof item.heat !== 'number' || item.heat < 1 || item.heat > 5) { console.error('  BAD HEAT: ' + item.id + ' -> ' + item.heat); dimErrors++; }
  if (typeof item.load !== 'number' || item.load < 1 || item.load > 3) { console.error('  BAD LOAD: ' + item.id + ' -> ' + item.load); dimErrors++; }
  if (!VALID_STYLE.includes(item.style)) { console.error('  BAD STYLE: ' + item.id + ' -> ' + item.style); dimErrors++; }
});
console.log('  Dimension errors: ' + dimErrors);

// 7. Final summary
console.log('\n=== SUMMARY ===');
console.log('Total items:', data.items.length);
console.log('Unique IDs:', ids.size);
console.log('Unique titles:', titles.size);
console.log('Hard errors:', errors);

const loadCounts = {};
const styleCounts = {};
const heatCounts = {};
data.items.forEach(item => {
  heatCounts[item.heat] = (heatCounts[item.heat] || 0) + 1;
  loadCounts[item.load] = (loadCounts[item.load] || 0) + 1;
  styleCounts[item.style] = (styleCounts[item.style] || 0) + 1;
});
console.log('\nHeat counts:');
Object.entries(heatCounts).sort((a,b) => a[0]-b[0]).forEach(([k, v]) => console.log('  heat ' + k + ': ' + v));
console.log('\nLoad counts:');
Object.entries(loadCounts).sort((a,b) => a[0]-b[0]).forEach(([k, v]) => console.log('  load ' + k + ': ' + v));
console.log('\nStyle counts:');
Object.entries(styleCounts).sort().forEach(([k, v]) => console.log('  ' + k + ': ' + v));
