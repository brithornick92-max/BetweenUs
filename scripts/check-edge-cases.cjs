const d = require('../content/prompts.json');

// Show heat 1 spicy prompts
console.log('=== HEAT 1 SPICY ===');
d.items.filter(p => p.heat === 1 && p.mood === 'spicy').forEach(p =>
  console.log(p.id, '|', p.category, '|', p.text.substring(0, 100)));

// Show items that feel wrong: heat 1-2 with spicy
console.log('\n=== HEAT 2 SPICY ===');
d.items.filter(p => p.heat === 2 && p.mood === 'spicy').forEach(p =>
  console.log(p.id, '|', p.category, '|', p.text.substring(0, 100)));

// Show all tranquil
console.log('\n=== TRANQUIL ===');
d.items.filter(p => p.mood === 'tranquil').forEach(p =>
  console.log(p.id, '|h' + p.heat, '|', p.category, '|', p.text.substring(0, 100)));

// Show all cozy
console.log('\n=== COZY ===');
d.items.filter(p => p.mood === 'cozy').forEach(p =>
  console.log(p.id, '|h' + p.heat, '|', p.category, '|', p.text.substring(0, 100)));

// Show 'light' depth prompts that might be wrong
console.log('\n=== LIGHT DEPTH (questionable - longer text) ===');
d.items.filter(p => p.depth === 'light' && p.text.length > 80).slice(0, 15).forEach(p =>
  console.log(p.id, '|h' + p.heat, '|', p.mood, '|', p.text.substring(0, 120)));

// Show heat 5 'deep' prompts to verify
console.log('\n=== HEAT 5 DEEP (first 20) ===');
d.items.filter(p => p.heat === 5 && p.depth === 'deep').slice(0, 20).forEach(p =>
  console.log(p.id, '|', p.mood, '|', p.text.substring(0, 100)));

// Show heat 1 sensory prompts -- likely should be tranquil/cozy
console.log('\n=== HEAT 1 SENSORY ===');
d.items.filter(p => p.heat === 1 && p.category === 'sensory').forEach(p =>
  console.log(p.id, '|', p.mood, '|', p.depth, '|', p.text.substring(0, 100)));

// Show heat 1 seasonal - likely cozy
console.log('\n=== HEAT 1 SEASONAL ===');
d.items.filter(p => p.heat === 1 && p.category === 'seasonal').forEach(p =>
  console.log(p.id, '|', p.mood, '|', p.depth, '|', p.text.substring(0, 100)));

// Show heat 1 kinky -- problematic?
console.log('\n=== HEAT 1 KINKY ===');
d.items.filter(p => p.heat === 1 && p.category === 'kinky').forEach(p =>
  console.log(p.id, '|', p.mood, '|', p.depth, '|', p.text.substring(0, 100)));

// Show heat 1 physical 
console.log('\n=== HEAT 1 PHYSICAL ===');
d.items.filter(p => p.heat === 1 && p.category === 'physical').forEach(p =>
  console.log(p.id, '|', p.mood, '|', p.depth, '|', p.text.substring(0, 100)));
