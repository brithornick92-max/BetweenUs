const data = require('../content/prompts.json');
const items = data.items;
console.log('Total prompts:', items.length);

// Check which fields exist
const fields = new Set();
items.forEach(item => Object.keys(item).forEach(k => fields.add(k)));
console.log('All fields:', [...fields].sort().join(', '));

// Check depth values
const depthValues = {};
let noDepth = 0;
const noDepthIds = [];
items.forEach(item => {
  if (item.depth === undefined || item.depth === null) {
    noDepth++;
    noDepthIds.push(item.id);
  } else {
    depthValues[item.depth] = (depthValues[item.depth] || 0) + 1;
  }
});
console.log('\nDepth distribution:', JSON.stringify(depthValues, null, 2));
console.log('Missing depth count:', noDepth);
if (noDepthIds.length > 0 && noDepthIds.length <= 50) {
  console.log('Missing depth IDs:', noDepthIds.join(', '));
}

// Check mood values
const moodValues = {};
let noMood = 0;
const noMoodIds = [];
items.forEach(item => {
  if (item.mood === undefined || item.mood === null) {
    noMood++;
    noMoodIds.push(item.id);
  } else {
    moodValues[item.mood] = (moodValues[item.mood] || 0) + 1;
  }
});
console.log('\nMood distribution:', JSON.stringify(moodValues, null, 2));
console.log('Missing mood count:', noMood);
if (noMoodIds.length > 0 && noMoodIds.length <= 50) {
  console.log('Missing mood IDs:', noMoodIds.join(', '));
}

// Check for placeholder/stub values
const suspiciousDepth = [];
const suspiciousMood = [];
const placeholderPatterns = ['TODO', 'FIXME', 'placeholder', 'stub', 'fake', 'test', 'TBD', 'xxx', 'null', 'undefined', 'N/A', 'none'];

items.forEach(item => {
  if (item.depth !== undefined && item.depth !== null) {
    const dStr = String(item.depth).toLowerCase();
    if (placeholderPatterns.some(p => dStr.includes(p.toLowerCase()))) {
      suspiciousDepth.push({ id: item.id, depth: item.depth });
    }
  }
  if (item.mood !== undefined && item.mood !== null) {
    const mStr = String(item.mood).toLowerCase();
    if (placeholderPatterns.some(p => mStr.includes(p.toLowerCase()))) {
      suspiciousMood.push({ id: item.id, mood: item.mood });
    }
  }
});

if (suspiciousDepth.length > 0) {
  console.log('\nSuspicious depth values:', JSON.stringify(suspiciousDepth, null, 2));
}
if (suspiciousMood.length > 0) {
  console.log('\nSuspicious mood values:', JSON.stringify(suspiciousMood, null, 2));
}

// Check depth and mood match prompt content
// Show sample of each depth and mood value
console.log('\n--- Sample prompts by depth ---');
const depthSamples = {};
items.forEach(item => {
  if (item.depth && !depthSamples[item.depth]) {
    depthSamples[item.depth] = { id: item.id, text: item.text.substring(0, 80), heat: item.heat, category: item.category };
  }
});
console.log(JSON.stringify(depthSamples, null, 2));

console.log('\n--- Sample prompts by mood ---');
const moodSamples = {};
items.forEach(item => {
  if (item.mood && !moodSamples[item.mood]) {
    moodSamples[item.mood] = { id: item.id, text: item.text.substring(0, 80), heat: item.heat, category: item.category };
  }
});
console.log(JSON.stringify(moodSamples, null, 2));

// Cross-check: depth vs heat level consistency
console.log('\n--- Depth by Heat Level ---');
const depthByHeat = {};
items.forEach(item => {
  if (!item.depth) return;
  const key = `heat_${item.heat}`;
  if (!depthByHeat[key]) depthByHeat[key] = {};
  depthByHeat[key][item.depth] = (depthByHeat[key][item.depth] || 0) + 1;
});
console.log(JSON.stringify(depthByHeat, null, 2));

// Cross-check: mood by heat level
console.log('\n--- Mood by Heat Level ---');
const moodByHeat = {};
items.forEach(item => {
  if (!item.mood) return;
  const key = `heat_${item.heat}`;
  if (!moodByHeat[key]) moodByHeat[key] = {};
  moodByHeat[key][item.mood] = (moodByHeat[key][item.mood] || 0) + 1;
});
console.log(JSON.stringify(moodByHeat, null, 2));
