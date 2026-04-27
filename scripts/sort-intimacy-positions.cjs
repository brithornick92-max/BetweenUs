const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const getIdNumber = (id) => {
  const match = String(id).match(/^ip(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

data.items.sort((a, b) => {
  const releaseA = Number(a.releaseWeek ?? Number.MAX_SAFE_INTEGER);
  const releaseB = Number(b.releaseWeek ?? Number.MAX_SAFE_INTEGER);

  if (releaseA !== releaseB) {
    return releaseA - releaseB;
  }

  return getIdNumber(a.id) - getIdNumber(b.id);
});

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Sorted ${data.items.length} intimacy positions by releaseWeek, then id.`);
