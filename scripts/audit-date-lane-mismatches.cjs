const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/dates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const dates = Array.isArray(data) ? data : data.items || [];

const moodMap = { 1: 'Heart', 2: 'Play', 3: 'Heat' };
const energyMap = { 1: 'Chill', 2: 'Moderate', 3: 'Active' };

const keywordSets = {
  heat: [
    'erotic', 'sensual', 'desire', 'pleasure', 'orgasm', 'sexy', 'strip',
    'lingerie', 'naked', 'body', 'touch', 'tease', 'edging', 'fantasy',
    'roleplay', 'makeout', 'aphrodisiac', 'blindfold', 'boudoir', 'intimate',
    'skin', 'spicy', 'sultry', 'passion', 'provocative'
  ],
  heart: [
    'love', 'letters', 'future', 'memory', 'gratitude', 'vows', 'healing',
    'childhood', 'story', 'forgiveness', 'repair', 'values', 'legacy',
    'dream', 'appreciation', 'connection', 'vulnerability', 'reflect',
    'journal', 'promise', 'milestone', 'family', 'trust'
  ],
  play: [
    'game', 'challenge', 'silly', 'arcade', 'karaoke', 'trivia', 'tournament',
    'thrift', 'adventure', 'mystery', 'comedy', 'paint', 'craft', 'photo booth',
    'mini golf', 'bowling', 'dance party', 'festival', 'fair', 'scavenger',
    'treasure', 'nerf', 'tiktok'
  ],
  active: [
    'hike', 'walk', 'tour', 'crawl', 'class', 'workshop', 'ride', 'kayak',
    'paddle', 'dance', 'dancing', 'climb', 'fitness', 'bike', 'market',
    'museum', 'concert', 'volunteer', 'garden', 'beach', 'camping',
    'sailing', 'train', 'lighthouse', 'carousel', 'bowling', 'golf',
    'horseback', 'scuba', 'escape room', 'festival'
  ],
  chill: [
    'bed', 'bath', 'couch', 'pajamas', 'candles', 'candlelit', 'slow',
    'cozy', 'nap', 'cuddle', 'snuggle', 'massage', 'reading', 'letters',
    'journaling', 'tea', 'coffee', 'breakfast in bed', 'blanket',
    'pillow', 'window', 'rainy', 'breathing', 'meditation'
  ],
  talking: [
    'talk', 'conversation', 'questions', 'question', 'discuss', 'share',
    'interview', 'reflection', 'reflect', 'read aloud', 'letters',
    'journal', 'confession', 'check-in', 'state of the union', 'story',
    'stories', 'quiz', 'values', 'dreams', 'future', 'gratitude'
  ],
  doing: [
    'make', 'create', 'build', 'cook', 'bake', 'paint', 'dance', 'play',
    'shop', 'visit', 'take', 'go to', 'watch', 'walk', 'hike', 'ride',
    'class', 'workshop', 'volunteer', 'decorate', 'record', 'film',
    'design', 'craft', 'plant', 'massage', 'stretch'
  ]
};

function textFor(date) {
  return [
    date.title,
    date.location,
    ...(Array.isArray(date.steps) ? date.steps : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function countMatches(text, words) {
  return words.reduce((count, word) => {
    return text.includes(word) ? count + 1 : count;
  }, 0);
}

function suggestMood(text) {
  const heatScore = countMatches(text, keywordSets.heat);
  const heartScore = countMatches(text, keywordSets.heart);
  const playScore = countMatches(text, keywordSets.play);

  const scores = [
    { heat: 3, label: 'Heat', score: heatScore },
    { heat: 1, label: 'Heart', score: heartScore },
    { heat: 2, label: 'Play', score: playScore },
  ].sort((a, b) => b.score - a.score);

  return scores[0].score > 0 ? scores[0] : null;
}

function suggestEnergy(text, date) {
  const activeScore = countMatches(text, keywordSets.active);
  const chillScore = countMatches(text, keywordSets.chill);

  let moderateScore = 0;
  const minutes = Number(date.minutes || 0);
  if (minutes >= 75 && minutes <= 105) moderateScore += 1;
  if (date.location === 'either') moderateScore += 1;

  const scores = [
    { load: 3, label: 'Active', score: activeScore },
    { load: 1, label: 'Chill', score: chillScore },
    { load: 2, label: 'Moderate', score: moderateScore },
  ].sort((a, b) => b.score - a.score);

  return scores[0].score > 0 ? scores[0] : null;
}

function suggestStyle(text) {
  const talkingScore = countMatches(text, keywordSets.talking);
  const doingScore = countMatches(text, keywordSets.doing);

  if (talkingScore > 0 && doingScore > 0) {
    return { style: 'mixed', label: 'Mixed', score: talkingScore + doingScore };
  }

  if (talkingScore > doingScore) {
    return { style: 'talking', label: 'Talking', score: talkingScore };
  }

  if (doingScore > talkingScore) {
    return { style: 'doing', label: 'Doing', score: doingScore };
  }

  return null;
}

const candidates = [];

for (const date of dates) {
  const text = textFor(date);

  const mood = suggestMood(text);
  const energy = suggestEnergy(text, date);
  const style = suggestStyle(text);

  const suggestions = [];

  if (mood && mood.heat !== date.heat && mood.score >= 2) {
    suggestions.push({
      field: 'heat',
      current: `${date.heat} ${moodMap[date.heat] || ''}`.trim(),
      suggested: `${mood.heat} ${mood.label}`,
      score: mood.score,
    });
  }

  if (energy && energy.load !== date.load && energy.score >= 2) {
    suggestions.push({
      field: 'load',
      current: `${date.load} ${energyMap[date.load] || ''}`.trim(),
      suggested: `${energy.load} ${energy.label}`,
      score: energy.score,
    });
  }

  if (style && style.style !== date.style && style.score >= 2) {
    suggestions.push({
      field: 'style',
      current: date.style,
      suggested: style.style,
      score: style.score,
    });
  }

  if (suggestions.length > 0) {
    candidates.push({
      id: date.id,
      title: date.title,
      currentLane: `${moodMap[date.heat]} + ${energyMap[date.load]} + ${date.style}`,
      suggestions,
      steps: date.steps || [],
    });
  }
}

let out = '';
out += `Total dates: ${dates.length}\n`;
out += `Possible lane mismatch candidates: ${candidates.length}\n\n`;

for (const item of candidates) {
  out += `${item.id}: ${item.title}\n`;
  out += `Current lane: ${item.currentLane}\n`;
  out += `Suggested review:\n`;

  for (const suggestion of item.suggestions) {
    out += `  - ${suggestion.field}: ${suggestion.current} -> ${suggestion.suggested} (score ${suggestion.score})\n`;
  }

  out += `Steps:\n`;
  for (const step of item.steps) {
    out += `  - ${step}\n`;
  }
  out += `\n`;
}

fs.writeFileSync('date-lane-mismatch-audit.txt', out);

console.log(`Created date-lane-mismatch-audit.txt`);
console.log(`Possible lane mismatch candidates: ${candidates.length}`);
