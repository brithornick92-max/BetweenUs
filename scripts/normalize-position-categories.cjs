const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const categoryMap = {
  'playful-energetic': 'playful-energy',
  'romantic-slow-intimate': 'deep-connection',
  'rear-behind': 'sensual-rhythm',
  'rear-adventurous': 'exploratory',
  'edge-adventurous': 'exploratory',
};

let changed = 0;

for (const item of data.items) {
  if (categoryMap[item.category]) {
    item.category = categoryMap[item.category];
    changed += 1;
  }
}

data.meta.totalPositions = data.items.length;
data.meta.releaseSchedule =
  '10 positions at launch (releaseWeek 0), then 1 new position per week through week 190. Full library screens can show all accessible positions for premium users.';

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Normalized ${changed} position categories.`);
console.log(`Total positions: ${data.items.length}`);
