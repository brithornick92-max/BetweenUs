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
  'Free starts with 5 sex positions and adds 1 each personal week. Premium starts with 10 sex positions from premium start and adds 3 each premium week.';

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Normalized ${changed} position categories.`);
console.log(`Total positions: ${data.items.length}`);
