const dates = require('../content/dates.json');
const all = dates.items;

// Verify all dates have heat 1-3
const badHeat = all.filter(d => d.heat < 1 || d.heat > 3);
console.log('Dates with invalid heat (should be 0):', badHeat.length);

// Verify all 27 combos
const combos = {};
all.forEach(d => {
  const key = d.heat + '-' + d.load + '-' + d.style;
  combos[key] = (combos[key] || 0) + 1;
});
const expected = [];
for (let h = 1; h <= 3; h++)
  for (let l = 1; l <= 3; l++)
    for (const s of ['talking','doing','mixed'])
      expected.push(h + '-' + l + '-' + s);

const missing = expected.filter(k => !(k in combos));
console.log('Missing combos (should be 0):', missing.length);
if (missing.length) console.log('  Missing:', missing);

const minCombo = Math.min(...Object.values(combos));
console.log('Min dates per combo:', minCombo);
console.log('Total dates:', all.length);

// Distribution
const moods = {1:0,2:0,3:0};
all.forEach(d => moods[d.heat]++);
console.log('Mood distribution: Heart=' + moods[1] + ' Play=' + moods[2] + ' Heat=' + moods[3]);
