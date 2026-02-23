// Debug script — verify dimension tags across all dates (heat/load/style)
const data = require('../content/dates.json');
const items = data.items;
console.log('Total items in JSON:', items.length);

const VALID_STYLE = ['talking', 'doing', 'mixed'];
const VALID_LOC   = ['home', 'out', 'either'];

let errors = 0;

items.forEach(date => {
  if (typeof date.heat !== 'number' || date.heat < 1 || date.heat > 5) {
    console.error('  ❌ ' + date.id + ': bad heat "' + date.heat + '"');
    errors++;
  }
  if (typeof date.load !== 'number' || date.load < 1 || date.load > 3) {
    console.error('  ❌ ' + date.id + ': bad load "' + date.load + '"');
    errors++;
  }
  if (!VALID_STYLE.includes(date.style)) {
    console.error('  ❌ ' + date.id + ': bad style "' + date.style + '"');
    errors++;
  }
  if (!VALID_LOC.includes(date.location)) {
    console.error('  ❌ ' + date.id + ': bad location "' + date.location + '"');
    errors++;
  }
  if (typeof date.minutes !== 'number' || date.minutes <= 0) {
    console.error('  ❌ ' + date.id + ': bad minutes "' + date.minutes + '"');
    errors++;
  }
});

console.log('\nValidation errors: ' + errors);

console.log('\n=== HEAT DISTRIBUTION (1-5) ===');
for (let h = 1; h <= 5; h++) {
  const count = items.filter(d => d.heat === h).length;
  console.log('  heat ' + h + ': ' + count);
}

console.log('\n=== LOAD DISTRIBUTION (1-3) ===');
for (let l = 1; l <= 3; l++) {
  const count = items.filter(d => d.load === l).length;
  console.log('  load ' + l + ': ' + count);
}

console.log('\n=== STYLE DISTRIBUTION ===');
VALID_STYLE.forEach(s => {
  const count = items.filter(d => d.style === s).length;
  console.log('  ' + s + ': ' + count);
});

console.log('\n=== LOCATION DISTRIBUTION ===');
VALID_LOC.forEach(l => {
  const count = items.filter(d => d.location === l).length;
  console.log('  ' + l + ': ' + count);
});

console.log('\n=== HEAT × LOAD MATRIX ===');
for (let h = 1; h <= 5; h++) {
  const row = [1, 2, 3].map(l => {
    const count = items.filter(d => d.heat === h && d.load === l).length;
    return 'load' + l + '=' + count;
  }).join(', ');
  console.log('  heat ' + h + ': ' + row);
}

console.log('\n=== HEAT × STYLE MATRIX ===');
for (let h = 1; h <= 5; h++) {
  const row = VALID_STYLE.map(s => {
    const count = items.filter(d => d.heat === h && d.style === s).length;
    return s + '=' + count;
  }).join(', ');
  console.log('  heat ' + h + ': ' + row);
}

console.log('\nTotal dates: ' + items.length);
console.log('Errors: ' + errors);
