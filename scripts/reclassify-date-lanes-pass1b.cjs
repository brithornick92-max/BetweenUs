const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/dates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/dates.json must have an items array');
}

const changes = {
  // Restore Heart talking lanes where the activity is mostly a container for conversation
  d455: { style: 'talking' }, // Couples Volunteer and Reflection
  d457: { style: 'talking' }, // Dessert Crawl and Deep Talks
  d304: { style: 'talking' }, // Cultural Heritage Sharing
  d280: { style: 'talking' }, // Life Story Interview
  d281: { style: 'talking' }, // Dream Sharing Night
  d293: { style: 'talking' }, // Fear Sharing Circle
  d306: { style: 'talking' }, // Hard Conversation Practice
  d308: { style: 'talking' }, // Strengths Finder Date

  // Restore Play talking lanes where the date is mainly discussion/story/interview
  d010: { style: 'talking' }, // Museum Storytelling Date
  d022: { style: 'talking' }, // Antique Shop Time Travel
  d105: { style: 'talking' }, // Midnight Diner Adventure
  d215: { style: 'talking' }, // Local History Walking Tour
  d505: { style: 'talking' }, // Flirty Debate Night

  // Restore Heat talking lanes where the core is explicit conversation, not activity
  d242: { style: 'talking' }, // Orgasm Gap Conversation
  d371: { style: 'talking' }, // Provocative Would You Rather
  d489: { style: 'talking' }, // Fantasy Whisper Game
  d504: { style: 'talking' }, // Provocative Question Jar
  d511: { style: 'talking' }, // Uninhibited Confessions Hike
};

let changed = 0;
const missing = [];

for (const [id, patch] of Object.entries(changes)) {
  const item = data.items.find((date) => date.id === id);
  if (!item) {
    missing.push(id);
    continue;
  }

  Object.assign(item, patch);
  changed += 1;
}

if (missing.length > 0) {
  throw new Error(`Missing date ids: ${missing.join(', ')}`);
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Reclassified ${changed} dates in pass 1b.`);
