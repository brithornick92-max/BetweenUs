/**
 * reclassify-dates.cjs — Reclassify all dates from heat 1-5 to mood 1-3
 * 
 * New system: 3 × 3 × 3 = 27 combinations
 *   mood:   1=Heart, 2=Play, 3=Heat
 *   load:   1=Chill, 2=Moderate, 3=Active  (was: Calm, Balanced, Energizing)
 *   style:  talking, doing, mixed           (unchanged)
 *
 * Mapping strategy:
 *   - Old heat 4-5 → mood 3 (Heat) — all sexual/explicit content
 *   - Old heat 3   → mood 3 (Heat) — sensual/physical content
 *   - Old heat 2   → keyword analysis to split Heart vs Play
 *   - Old heat 1   → keyword analysis to split Heart vs Play
 */

const fs = require('fs');
const path = require('path');

const DATES_PATH = path.join(__dirname, '..', 'content', 'dates.json');
const data = JSON.parse(fs.readFileSync(DATES_PATH, 'utf8'));

// Keywords that indicate "Heart" (emotional, romantic, deep connection)
const HEART_KEYWORDS = [
  'letter', 'letters', 'journal', 'gratitude', 'memory', 'memories', 'prayer',
  'meditat', 'mindful', 'spiritual', 'soul', 'vow', 'promise', 'dream',
  'reflect', 'reflection', 'meaningful', 'deep', 'vulnerable', 'emotion',
  'feeling', 'affirmation', 'appreciate', 'love letter', 'heart', 'heartfelt',
  'stargazing', 'stargazer', 'sunset', 'sunrise', 'candlelit', 'candle',
  'romantic', 'romance', 'slow dance', 'serenade', 'poetry', 'poem',
  'lullaby', 'moonlight', 'whisper', 'gentle', 'tender', 'sweet', 'softly',
  'pillow talk', 'cuddle', 'spoon', 'snuggle', 'cozy', 'intimate',
  'ceremony', 'ritual', 'blessing', 'sacred', 'honoring', 'legacy',
  'bucket list', 'future', 'milestone', 'anniversary', 'timeline',
  'storytelling', 'stories', 'confession', 'forgiveness', 'apologize',
  'healing', 'comfort', 'support', 'trust', 'bonding', 'connected',
  'eye gaz', 'eye contact', 'listening', 'conversation',
  'photograph', 'photo walk', 'scrapbook', 'memory box', 'time capsule',
  'nostalgia', 'childhood', 'remember', 'sentimental',
  'balcony', 'garden', 'picnic', 'reading', 'tea', 'morning coffee',
  'love map', 'attachment', 'relationship', 'commitment',
  'tarot', 'horoscope', 'astrology', 'personality',
  'creative writing', 'write together',
];

// Keywords that indicate "Play" (fun, active, lighthearted, adventurous)
const PLAY_KEYWORDS = [
  'game', 'games', 'tournament', 'competition', 'challenge', 'contest',
  'arcade', 'bowling', 'mini golf', 'golf', 'karaoke', 'trivia',
  'comedy', 'funny', 'laugh', 'silly', 'goofy', 'prank', 'joke',
  'adventure', 'explore', 'discover', 'treasure', 'hunt', 'scavenger',
  'hike', 'hiking', 'bike', 'cycling', 'kayak', 'paddle', 'swim',
  'thrift', 'shopping', 'flea market', 'vintage', 'antique',
  'cooking', 'baking', 'recipe', 'chef', 'kitchen', 'sushi',
  'cocktail', 'mixology', 'bartend', 'wine tasting', 'beer',
  'craft', 'pottery', 'painting', 'art class', 'diy', 'build',
  'dance class', 'salsa', 'swing', 'tango', 'hip hop',
  'museum', 'gallery', 'exhibit', 'zoo', 'aquarium', 'planetarium',
  'concert', 'live music', 'jazz', 'festival', 'show',
  'escape room', 'mystery', 'puzzle', 'detective',
  'travel', 'road trip', 'drive', 'explore', 'wander',
  'food tour', 'restaurant', 'brunch', 'lunch', 'dinner',
  'sport', 'tennis', 'rock climb', 'yoga', 'gym', 'workout',
  'improv', 'stand-up', 'performance',
  'movie', 'cinema', 'film', 'drive-in',
  'fort', 'pillow fight', 'blanket', 'tent', 'camping',
  'board game', 'card game', 'video game',
  'chocolate', 'cheese', 'tasting',
  'record store', 'bookstore', 'library',
  'farmers market', 'market', 'fair',
  'perfume', 'fragrance',
  'fashion', 'style', 'makeover', 'dress up',
  'photo', 'selfie', 'camera',
  'dessert', 'ice cream', 'pastry', 'bakery',
  'spa day', 'facial', 'mani', 'pedi',
  'star wars', 'cosplay', 'costume',
  'water park', 'amusement', 'roller coaster',
  'surfing', 'skateboard', 'snowboard', 'ski',
];

function classifyMood(date) {
  // Heat 4-5 → always Heat (mood 3)
  if (date.heat >= 4) return 3;
  
  // Heat 3 → almost always Heat (mood 3), sensual/physical content
  if (date.heat === 3) return 3;
  
  // Heat 1-2 → analyze title + steps for Heart vs Play
  const text = [
    date.title || '',
    ...(Array.isArray(date.steps) ? date.steps : []),
  ].join(' ').toLowerCase();
  
  let heartScore = 0;
  let playScore = 0;
  
  for (const kw of HEART_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) heartScore++;
  }
  for (const kw of PLAY_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) playScore++;
  }
  
  // For heat-2 dates, lean more toward Heart (they're romantic)
  if (date.heat === 2) {
    heartScore += 1; // slight romantic bias
  }
  
  // For heat-1 active dates (load 3), lean toward Play
  if (date.heat === 1 && date.load === 3) {
    playScore += 0.5;
  }
  
  if (heartScore > playScore) return 1; // Heart
  if (playScore > heartScore) return 2; // Play
  
  // Tie-break: heat 2 → Heart, heat 1 → Play
  return date.heat === 2 ? 1 : 2;
}

// Reclassify all dates
let changed = 0;
const moodDist = { 1: 0, 2: 0, 3: 0 };
const comboCounts = {};

data.items.forEach(item => {
  const oldHeat = item.heat;
  const newMood = classifyMood(item);
  item.heat = newMood; // reuse the 'heat' field but now it means mood 1-3
  
  moodDist[newMood]++;
  const combo = `${newMood}-${item.load}-${item.style}`;
  comboCounts[combo] = (comboCounts[combo] || 0) + 1;
  
  if (oldHeat !== newMood) changed++;
});

// Update meta
data.meta.heat = {
  "1": "Heart — Emotional, romantic, deep connection",
  "2": "Play — Fun, lighthearted, adventurous",
  "3": "Heat — Sensual, steamy, passionate"
};
data.meta.energy = {
  "chill": "Low-key and relaxing",
  "moderate": "Some activity, balanced pace",
  "active": "Physical or high-energy"
};
data.meta.dimensions = {
  "mood": "1-3 (Heart, Play, Heat)",
  "load": "1-3 (Chill, Moderate, Active)",
  "style": "talking | doing | mixed"
};

// Write
fs.writeFileSync(DATES_PATH, JSON.stringify(data, null, 2) + '\n');

// Report
console.log(`\nReclassified ${changed} of ${data.items.length} dates`);
console.log(`\nMood distribution:`);
console.log(`  Heart (1): ${moodDist[1]}`);
console.log(`  Play  (2): ${moodDist[2]}`);
console.log(`  Heat  (3): ${moodDist[3]}`);

console.log(`\nLoad distribution:`);
const loadDist = { 1: 0, 2: 0, 3: 0 };
data.items.forEach(i => loadDist[i.load]++);
console.log(`  Chill    (1): ${loadDist[1]}`);
console.log(`  Moderate (2): ${loadDist[2]}`);
console.log(`  Active   (3): ${loadDist[3]}`);

console.log(`\nStyle distribution:`);
const styleDist = {};
data.items.forEach(i => { styleDist[i.style] = (styleDist[i.style]||0)+1; });
Object.entries(styleDist).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

console.log(`\n--- All 27 combinations ---`);
const allCombos = [];
for (let m = 1; m <= 3; m++) {
  for (let l = 1; l <= 3; l++) {
    for (const s of ['talking', 'doing', 'mixed']) {
      const key = `${m}-${l}-${s}`;
      const count = comboCounts[key] || 0;
      const moodLabel = { 1: 'Heart', 2: 'Play', 3: 'Heat' }[m];
      const loadLabel = { 1: 'Chill', 2: 'Moderate', 3: 'Active' }[l];
      allCombos.push({ key, count, label: `${moodLabel} × ${loadLabel} × ${s}` });
    }
  }
}

allCombos.forEach(c => {
  const bar = '█'.repeat(c.count);
  const warn = c.count === 0 ? ' ⚠️ EMPTY' : c.count < 5 ? ' ⚠️ LOW' : '';
  console.log(`  ${c.label.padEnd(30)} ${String(c.count).padStart(4)} ${bar}${warn}`);
});

const empties = allCombos.filter(c => c.count === 0);
const low = allCombos.filter(c => c.count > 0 && c.count < 5);
console.log(`\n${empties.length} empty combos, ${low.length} low (<5) combos`);
