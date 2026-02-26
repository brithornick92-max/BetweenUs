const d = require('../content/dates.json');
const items = d.items;
console.log('Total dates:', items.length);

const heatDist = {};
const loadDist = {};
const styleDist = {};
const missingHeat = [];
const missingLoad = [];
const missingStyle = [];

items.forEach(i => {
  if (typeof i.heat === 'number') heatDist[i.heat] = (heatDist[i.heat]||0)+1;
  else missingHeat.push(i.id);
  
  if (typeof i.load === 'number') loadDist[i.load] = (loadDist[i.load]||0)+1;
  else missingLoad.push(i.id);
  
  if (i.style) styleDist[i.style] = (styleDist[i.style]||0)+1;
  else missingStyle.push(i.id);
});

console.log('Heat distribution:', JSON.stringify(heatDist));
console.log('Load distribution:', JSON.stringify(loadDist));
console.log('Style distribution:', JSON.stringify(styleDist));
console.log('Missing heat (' + missingHeat.length + '):', missingHeat.slice(0,10));
console.log('Missing load (' + missingLoad.length + '):', missingLoad.slice(0,10));
console.log('Missing style (' + missingStyle.length + '):', missingStyle.slice(0,10));

// Check for valid ranges
const badHeat = items.filter(i => typeof i.heat === 'number' && (i.heat < 1 || i.heat > 5));
const badLoad = items.filter(i => typeof i.load === 'number' && (i.load < 1 || i.load > 3));
const badStyle = items.filter(i => i.style && !['talking','doing','mixed'].includes(i.style));
console.log('Bad heat values:', badHeat.length, badHeat.map(i => i.id + ':' + i.heat));
console.log('Bad load values:', badLoad.length, badLoad.map(i => i.id + ':' + i.load));
console.log('Bad style values:', badStyle.length, badStyle.map(i => i.id + ':' + i.style));

// Check which dates exist per combination
console.log('\n--- Cross-tabulation (heat x load) ---');
for (let h = 1; h <= 5; h++) {
  const counts = [];
  for (let l = 1; l <= 3; l++) {
    const c = items.filter(i => i.heat === h && i.load === l).length;
    counts.push('load' + l + '=' + c);
  }
  console.log('heat ' + h + ':', counts.join(', '));
}

// Test filterDates behavior
console.log('\n--- Filter test ---');
const { filterDates, getAllDates, getDimensionMeta } = require('../utils/contentLoader');
const all = getAllDates();
console.log('getAllDates() count:', all.length);

// Filter by each heat level
for (let h = 1; h <= 5; h++) {
  const filtered = filterDates(all, { heat: h });
  console.log('heat=' + h + ':', filtered.length, 'dates');
}

// Filter by load
for (let l = 1; l <= 3; l++) {
  const filtered = filterDates(all, { load: l });
  console.log('load=' + l + ':', filtered.length, 'dates');
}

// Filter by style
for (const s of ['talking', 'doing', 'mixed']) {
  const filtered = filterDates(all, { style: s });
  console.log('style=' + s + ':', filtered.length, 'dates');
}

// Combined filter
const combo = filterDates(all, { heat: 3, load: 2, style: 'mixed' });
console.log('heat=3 + load=2 + style=mixed:', combo.length, 'dates');
if (combo.length > 0) console.log('  sample:', combo[0].id, combo[0].title);
