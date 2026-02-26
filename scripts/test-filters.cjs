const d = require('../content/dates.json');
const items = d.items;

function filterDates(items, filters) {
  const { heat, load, style, maxHeat, minHeat } = filters;
  return items.filter(i => {
    if (heat !== undefined && heat !== null && i.heat !== heat) return false;
    if (maxHeat && i.heat > maxHeat) return false;
    if (minHeat && i.heat < minHeat) return false;
    if (load !== undefined && load !== null && i.load !== load) return false;
    if (style && i.style !== style) return false;
    return true;
  });
}

console.log('Total:', items.length);
for (let h = 1; h <= 5; h++) {
  console.log('heat=' + h + ':', filterDates(items, { heat: h }).length);
}
for (let l = 1; l <= 3; l++) {
  console.log('load=' + l + ':', filterDates(items, { load: l }).length);
}
for (const s of ['talking','doing','mixed']) {
  console.log('style=' + s + ':', filterDates(items, { style: s }).length);
}
console.log('heat=3,load=2,style=mixed:', filterDates(items, { heat: 3, load: 2, style: 'mixed' }).length);
console.log('heat=5,load=1:', filterDates(items, { heat: 5, load: 1 }).length);

// Check what detail screen sees
const sample = items.find(i => i.id === 'd004');
console.log('\nSample date d004:', JSON.stringify(sample, null, 2));
