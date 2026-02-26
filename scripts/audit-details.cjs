const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'content', 'prompts.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Check near-duplicates
const pairs = [
  ['h1_034', 'h1_050'],
  ['h3_017', 'h3_033'],
  ['h3_003', 'h3_039'],
  ['h4_003', 'h4_011'],
  ['h5_012', 'h5_021'],
  ['h5_015', 'h5_027'],
  ['h5_012', 'h5_030'],
  ['h5_014', 'h5_038'],
  ['h5_012', 'h5_048'],
  ['h3_077', 'h3_086'],
  ['h5_066', 'h5_083'],
  ['h5_073', 'h5_rp_10'],
];

console.log('=== NEAR-DUPLICATE PAIRS ===\n');
pairs.forEach(([a, b]) => {
  const pa = data.items.find(p => p.id === a);
  const pb = data.items.find(p => p.id === b);
  if (pa && pb) {
    console.log(a + ': ' + pa.text);
    console.log(b + ': ' + pb.text);
    console.log('');
  }
});

// Check specific text issues
['h1_109', 'h4_060', 'h2_066', 'h2_067', 'h2_071'].forEach(id => {
  const p = data.items.find(i => i.id === id);
  if (p) {
    console.log('=== ' + id + ' ===');
    console.log('Text: ' + p.text);
    console.log('Heat: ' + p.heat + ', Category: ' + p.category);
    console.log('');
  }
});

// Check mild heat 5 prompts in detail
console.log('=== MILD HEAT 5 PROMPTS ===\n');
const mildH5 = ['h5_006','h5_007','h5_010','h5_025','h5_028','h5_034','h5_040','h5_060','h5_061','h5_064','h5_074','h5_088'];
mildH5.forEach(id => {
  const p = data.items.find(i => i.id === id);
  if (p) {
    console.log(id + ' [' + p.category + ']: ' + p.text);
  }
});
