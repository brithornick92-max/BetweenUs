const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'content/intimacy-positions.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

if (!data || !Array.isArray(data.items)) {
  throw new Error('content/intimacy-positions.json must have an items array');
}

const patches = {
  ip101: {
    whyPeopleLikeIt: 'It feels familiar, supported, and easy to trust. Many couples like it because the pillow lift can make classic face-to-face closeness feel more comfortable and more intentional.'
  },
  ip052: {
    whyPeopleLikeIt: 'It feels slow, close, and intensely connected. Many couples like it because the rhythm comes from pressure and alignment instead of speed.'
  },
  ip053: {
    whyPeopleLikeIt: 'It feels open and structured at the same time. Many couples like it because the edge support creates a clear angle without making the position feel unstable.'
  },
  ip054: {
    whyPeopleLikeIt: 'It feels intimate, grounded, and easy to hold. Many couples like it because the chair creates support while keeping both partners face-to-face.'
  },
  ip055: {
    whyPeopleLikeIt: 'It feels cozy and low-pressure. Many couples like it because the side-lying shape lets them stay close without needing much energy.'
  },
  ip056: {
    whyPeopleLikeIt: 'It feels woven together and emotionally close. Many couples like it because the leg wrap adds connection while the side-lying setup stays comfortable.'
  },
  ip057: {
    whyPeopleLikeIt: 'It feels warm, secure, and familiar. Many couples like it because the wrapped legs create closeness without requiring a complicated setup.'
  },
  ip058: {
    whyPeopleLikeIt: 'It feels bold and spontaneous while still having support. Many couples like it because the wall makes upright closeness feel steadier and more confident.'
  },
  ip059: {
    whyPeopleLikeIt: 'It feels direct, grounded, and easy to adjust. Many couples like it because the bed support helps create intensity without asking the front partner to hold everything alone.'
  },
  ip060: {
    whyPeopleLikeIt: 'It feels low, warm, and body-close. Many couples like it because the pillow support softens the position while keeping the angle useful.'
  },
  ip061: {
    whyPeopleLikeIt: 'It feels playful, attentive, and easy to communicate through. Many couples like it because the seated setup gives both partners a more comfortable structure.'
  },
  ip062: {
    whyPeopleLikeIt: 'It feels open, cared for, and responsive. Many couples like it because the reclined support helps receiving feel relaxed instead of effortful.'
  },
  ip063: {
    whyPeopleLikeIt: 'It feels adventurous without becoming a full lift. Many couples like it because the raised-leg shape adds spark while still allowing balance support.'
  },
  ip064: {
    whyPeopleLikeIt: 'It feels intimate and full-bodied. Many couples like it because the legs-around-waist shape keeps the bodies close and emotionally gathered.'
  },
  ip065: {
    whyPeopleLikeIt: 'It feels curious and different without being overly complicated. Many couples like it because the sideways angle refreshes an edge-of-bed setup.'
  },
  ip066: {
    whyPeopleLikeIt: 'It feels quiet, tender, and grounding. Many couples like it because the stillness gives the moment emotional weight instead of pushing it forward.'
  },
  ip067: {
    whyPeopleLikeIt: 'It feels mutual, upright, and passionate. Many couples like it because both partners are visibly engaged and close at the same time.'
  },
  ip068: {
    whyPeopleLikeIt: 'It feels focused and adjustable. Many couples like it because lifting one leg changes the angle without requiring a more demanding shape.'
  },
  ip069: {
    whyPeopleLikeIt: 'It feels confident and customizable. Many couples like it because circular movement gives the partner on top more control over pressure and rhythm.'
  },
  ip070: {
    whyPeopleLikeIt: 'It feels caring and emotionally complete. Many couples like it because staying close afterward turns aftercare into part of the intimacy.'
  },
  ip071: {
    whyPeopleLikeIt: 'It feels devoted and sincere. Many couples like it because chest-to-chest stillness creates connection without needing more movement.'
  },
  ip072: {
    whyPeopleLikeIt: 'It feels tender and emotionally safe. Many couples like it because the forehead contact naturally slows the pace and makes closeness feel intentional.'
  },
  ip073: {
    whyPeopleLikeIt: 'It feels warm and supported. Many couples like it because the reclined lap shape gives face-to-face closeness without as much physical effort.'
  },
  ip074: {
    whyPeopleLikeIt: 'It feels romantic, simple, and easy to settle into. Many couples like it because the familiar shape leaves room for kissing, softness, and emotional closeness.'
  },
  ip075: {
    whyPeopleLikeIt: 'It feels safe, held, and deeply reassuring. Many couples like it because the full-body embrace makes intimacy feel comforting rather than performative.'
  }
};

const missing = [];
let changed = 0;

for (const [id, patch] of Object.entries(patches)) {
  const item = data.items.find((position) => position.id === id);

  if (!item) {
    missing.push(id);
    continue;
  }

  Object.assign(item, patch);
  changed += 1;
}

if (missing.length > 0) {
  throw new Error(`Missing position ids: ${missing.join(', ')}`);
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

console.log(`Updated whyPeopleLikeIt for ${changed} intimacy positions.`);
