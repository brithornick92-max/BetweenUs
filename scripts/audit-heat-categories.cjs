const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'dates.json'), 'utf8'));
const items = data.items;

// Keywords that suggest sexual/sensual content → should be Heat 3
const heatKeywords = [
  'sensual', 'intimate touch', 'massage', 'body', 'lingerie', 'undress',
  'kiss', 'makeout', 'make out', 'foreplay', 'seduc', 'strip', 'blindfold',
  'erotic', 'sexy', 'passion', 'desire', 'touch each other', 'physical intimacy',
  'bed together', 'candle.*body', 'oil', 'steamy', 'skin', 'caress',
  'bedroom', 'tease', 'tension', 'role.?play', 'fantasy', 'fantasies',
  'aphrodisiac', 'pleasure', 'turn.?on', 'arousal', 'love.?making', 'lovemaking',
  'lips', 'whisper.*ear', 'neck', 'hot tub', 'bath together', 'shower together',
  'trace', 'nibble', 'bite', 'striptease', 'strip tease', 'lap dance',
  'wine.*bath', 'bubble bath', 'naked', 'clothes off', 'take off',
  'physical connection', 'spicy'
];

// Keywords that suggest emotional/heart content → should be Heat 1
const heartKeywords = [
  'gratitude', 'grateful', 'appreciate', 'vulnerability', 'vulnerable',
  'emotional', 'feelings', 'deep conversation', 'love letter', 'letter writing',
  'vow', 'prayer', 'spiritual', 'meditation', 'mindful', 'childhood',
  'memory', 'memories', 'reminisce', 'heartfelt', 'meaningful',
  'core values', 'goals', 'dreams.*future', 'future together', 'bucket list',
  'share.*fear', 'share.*hope', 'share.*dream', 'forgive', 'heal',
  'journal', 'reflection', 'reflective', 'thankful', 'affirmation',
  'relationship.*check', 'relationship.*goal', 'love language',
  'cry together', 'open up', 'trust', 'bonding', 'attachment',
  'soul', 'profound', 'sacred', 'ceremony', 'ritual'
];

// Keywords suggesting fun/play content → should be Heat 2
const playKeywords = [
  'game', 'competition', 'challenge', 'race', 'sport', 'puzzle',
  'trivia', 'karaoke', 'dance party', 'adventure', 'explore',
  'scavenger hunt', 'prank', 'silly', 'goofy', 'fun',
  'cook.*together', 'bake', 'craft', 'build', 'create',
  'movie marathon', 'board game', 'video game', 'arcade',
  'hike', 'bike', 'swim', 'bowling', 'mini golf', 'roller',
  'theme park', 'amusement', 'festival', 'concert', 'paint',
  'pottery', 'comedy', 'improv', 'talent show', 'treasure hunt',
  'fort', 'pillow fight', 'water.*fight', 'nerf', 'obstacle',
  'taste test', 'food.*challenge', 'cooking.*competition'
];

function matchesKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.filter(k => {
    try { return new RegExp(k, 'i').test(lower); }
    catch { return lower.includes(k); }
  });
}

const issues = [];

for (const item of items) {
  const text = [item.title, ...(item.steps || [])].join(' ');
  const heatMatches = matchesKeywords(text, heatKeywords);
  const heartMatches = matchesKeywords(text, heartKeywords);
  const playMatches = matchesKeywords(text, playKeywords);

  let suggestedHeat = item.heat;
  let reason = '';

  // Check for misclassifications
  if (item.heat === 1) {
    // Currently Heart - should it be Play or Heat?
    if (heatMatches.length >= 2) {
      suggestedHeat = 3;
      reason = `Heart→Heat: sexual keywords [${heatMatches.join(', ')}]`;
    } else if (playMatches.length >= 2 && heartMatches.length === 0) {
      suggestedHeat = 2;
      reason = `Heart→Play: play keywords [${playMatches.join(', ')}] no heart keywords`;
    }
  } else if (item.heat === 2) {
    // Currently Play - should it be Heart or Heat?
    if (heatMatches.length >= 2) {
      suggestedHeat = 3;
      reason = `Play→Heat: sexual keywords [${heatMatches.join(', ')}]`;
    } else if (heartMatches.length >= 2 && playMatches.length === 0) {
      suggestedHeat = 1;
      reason = `Play→Heart: heart keywords [${heartMatches.join(', ')}] no play keywords`;
    }
  } else if (item.heat === 3) {
    // Currently Heat - is this actually not sexual?
    if (heatMatches.length === 0 && heartMatches.length >= 2) {
      suggestedHeat = 1;
      reason = `Heat→Heart: no sexual keywords, heart keywords [${heartMatches.join(', ')}]`;
    } else if (heatMatches.length === 0 && playMatches.length >= 2) {
      suggestedHeat = 2;
      reason = `Heat→Play: no sexual keywords, play keywords [${playMatches.join(', ')}]`;
    } else if (heatMatches.length === 0) {
      suggestedHeat = 2;
      reason = `Heat→Play: no sexual keywords found`;
    }
  }

  if (suggestedHeat !== item.heat) {
    issues.push({
      id: item.id,
      title: item.title,
      currentHeat: item.heat,
      suggestedHeat,
      reason,
      heatMatches: heatMatches.length,
      heartMatches: heartMatches.length,
      playMatches: playMatches.length,
      steps: item.steps
    });
  }
}

// Sort by current heat for readability
issues.sort((a, b) => a.currentHeat - b.currentHeat || a.id.localeCompare(b.id));

console.log(`\n=== HEAT CATEGORY AUDIT ===`);
console.log(`Total dates: ${items.length}`);
console.log(`Potentially miscategorized: ${issues.length}\n`);

// Group by change type
const groups = {};
for (const i of issues) {
  const key = `Heat ${i.currentHeat} → ${i.suggestedHeat}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push(i);
}

for (const [group, entries] of Object.entries(groups)) {
  console.log(`\n── ${group} (${entries.length}) ──`);
  for (const e of entries) {
    console.log(`  ${e.id}: "${e.title}" — ${e.reason}`);
    if (e.steps) {
      for (const s of e.steps) console.log(`      • ${s}`);
    }
    console.log('');
  }
}
