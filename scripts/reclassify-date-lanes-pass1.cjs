const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/dates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/dates.json must have an items array');
}

const changes = {
  // Heart / outdoors / active or clearly mixed
  d073: { load: 3 }, // Moonlight Kayaking
  d093: { load: 3, style: 'mixed' }, // Moonlight Beach Walk
  d254: { style: 'mixed' }, // Lake Sunset Paddleboard
  d267: { load: 3, style: 'mixed' }, // Sunset Sailboat Ride
  d264: { style: 'mixed' }, // Romantic Ferris Wheel Ride
  d304: { style: 'mixed' }, // Cultural Heritage Sharing
  d455: { style: 'mixed' }, // Couples Volunteer and Reflection
  d457: { style: 'mixed' }, // Dessert Crawl and Deep Talks
  d558: { load: 3 }, // Night Bus or Last-Stop Date

  // Play active dates that are more mixed than pure doing/talking
  d010: { style: 'mixed' }, // Museum Storytelling Date
  d022: { style: 'mixed' }, // Antique Shop Time Travel
  d040: { style: 'mixed' }, // Pottery Painting Date
  d110: { style: 'mixed' }, // Midnight Bowling Date
  d219: { style: 'mixed' }, // Flirty Tapas Cook-Off
  d232: { style: 'mixed' }, // Flirty Karaoke Duet
  d105: { style: 'mixed' }, // Midnight Diner Adventure
  d215: { style: 'mixed' }, // Local History Walking Tour
  d440: { style: 'mixed' }, // Mystery Envelope Adventure
  d462: { style: 'mixed' }, // Couples Escape Room and Dinner Debrief
  d505: { style: 'mixed' }, // Flirty Debate Night

  // Heart talking dates that are actually activity + conversation
  d084: { style: 'mixed' }, // Love Language Workshop
  d216: { style: 'mixed' }, // Couples Gratitude Practice
  d280: { style: 'mixed' }, // Life Story Interview
  d281: { style: 'mixed' }, // Dream Sharing Night
  d285: { style: 'mixed' }, // Inner Child Play Date
  d290: { style: 'mixed' }, // Attachment Style Exploration
  d293: { style: 'mixed' }, // Fear Sharing Circle
  d297: { style: 'mixed' }, // Apology Language Discovery
  d301: { style: 'mixed' }, // Childhood Dream Revisit
  d302: { style: 'mixed' }, // Conflict Resolution Playbook
  d306: { style: 'mixed' }, // Hard Conversation Practice
  d308: { style: 'mixed' }, // Strengths Finder Date

  // Heat dates that clearly mix conversation/action
  d095: { style: 'mixed' }, // Erotic Art Creation
  d242: { style: 'mixed' }, // Orgasm Gap Conversation
  d243: { style: 'mixed' }, // Erotic Movie & Makeout Night
  d359: { heat: 3 }, // Whisper Challenge Spicy Edition
  d368: { style: 'mixed' }, // Couples Erotica Co-Writing
  d371: { style: 'mixed' }, // Provocative Would You Rather
  d489: { style: 'mixed' }, // Fantasy Whisper Game
  d504: { style: 'mixed' }, // Provocative Question Jar
  d511: { style: 'mixed' }, // Uninhibited Confessions Hike

  // Heat doing/mixed cleanup
  d453: { style: 'mixed' }, // Waterfall Hike and Skinny Dip
  d501: { style: 'doing' }, // Hotel Room Roleplay
  d509: { style: 'doing' }, // Sensual Obstacle Course
  d510: { heat: 3, style: 'doing' }, // Couples Yoga & Body Painting
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

console.log(`Reclassified ${changed} dates.`);
