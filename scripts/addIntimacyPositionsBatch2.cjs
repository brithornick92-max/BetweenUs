const fs = require('fs');

const targetPath = process.argv[2] || './content/intimacy-positions.json';

if (!fs.existsSync(targetPath)) {
  console.error(`Could not find file: ${targetPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const items = data.items || [];

const existingIds = new Set(items.map((item) => item.id));
const existingTitles = new Set(items.map((item) => item.title));

const rawBatch = [
  ['ip102', 'The Fireside', 'Seated Sofa Closeness', 'deep-connection', 'standard', 'warm', 2, ['Sofa', 'Seated', 'Close', 'Warm']],
  ['ip103', 'The Folded Blanket', 'Side Spooning with Knee Support', 'deep-connection', 'low-mobility', 'cozy', 1, ['Spooning', 'Knee Support', 'Soft', 'Low Effort']],
  ['ip104', 'The Murmur', 'Whispering Hold', 'deep-connection', 'low-mobility', 'tender', 1, ['Whispering', 'Stillness', 'Close', 'Emotional']],
  ['ip105', 'The Slow Window', 'Edge Recline Gentle Pace', 'sensual-rhythm', 'standard', 'soft', 2, ['Edge-Supported', 'Reclined', 'Gentle', 'Slow']],
  ['ip106', 'The Rest', 'Low-Effort Full Contact', 'deep-connection', 'low-mobility', 'restful', 1, ['Full Contact', 'Low Effort', 'Soft', 'Grounded']],
  ['ip107', 'The Gentle Thread', 'Loose Leg Tangle', 'deep-connection', 'low-mobility', 'gentle', 1, ['Leg Tangle', 'Soft', 'Side-Lying', 'Connected']],
  ['ip108', 'The Sway', 'Soft Hip Rocking', 'sensual-rhythm', 'standard', 'sensual', 2, ['Rocking', 'Slow', 'Rhythm', 'Soft']],
  ['ip109', 'The Drowsy Flame', 'Sleepy Spooning', 'deep-connection', 'low-mobility', 'sleepy', 1, ['Spooning', 'Sleepy', 'Cozy', 'Low Effort']],
  ['ip110', 'The Quiet Shore', 'Side Recline', 'deep-connection', 'low-mobility', 'calm', 1, ['Side-Lying', 'Reclined', 'Gentle', 'Soft']],
  ['ip111', 'The Held Breath', 'Chest-to-Back Stillness', 'trust-vulnerability', 'low-mobility', 'vulnerable', 1, ['Chest-to-Back', 'Stillness', 'Held', 'Slow']],

  ['ip112', 'The Compass', 'Angled Missionary', 'sensual-rhythm', 'standard', 'focused', 3, ['Face-to-Face', 'Angled', 'Classic', 'Focused']],
  ['ip113', 'The Tilt', 'Hip Pillow Lift', 'sensual-rhythm', 'standard', 'heated', 3, ['Pillow-Supported', 'Hips Lifted', 'Open', 'Focused']],
  ['ip114', 'The Spiral', 'Circular Hip Rhythm', 'sensual-rhythm', 'standard', 'sensual', 3, ['Circular Rhythm', 'Slow Burn', 'Body-Led', 'Responsive']],
  ['ip115', 'The Pressed Bloom', 'Prone with Pillow', 'sensual-rhythm', 'low-mobility', 'grounded', 2, ['Prone', 'Pillow-Supported', 'Grounded', 'Slow']],
  ['ip116', 'The Arc', 'One Leg Lifted', 'sensual-rhythm', 'standard', 'open', 3, ['Leg Lift', 'Open', 'Supported', 'Focused']],
  ['ip117', 'The Slope', 'Reclined Hip Elevation', 'sensual-rhythm', 'standard', 'heated', 3, ['Reclined', 'Hips Elevated', 'Open', 'Supported']],
  ['ip118', 'The Line', 'Straight-Leg Missionary', 'sensual-rhythm', 'standard', 'steady', 2, ['Face-to-Face', 'Straight Legs', 'Classic', 'Steady']],
  ['ip119', 'The Pendulum', 'Slow Forward-Back Rhythm', 'sensual-rhythm', 'standard', 'rhythmic', 2, ['Forward-Back', 'Slow', 'Rhythm', 'Controlled']],
  ['ip120', 'The Counterpoint', 'Alternating Pace', 'sensual-rhythm', 'standard', 'playful', 3, ['Pace Play', 'Responsive', 'Rhythm', 'Interactive']],
  ['ip121', 'The Tempo', 'Guided Rhythm Hold', 'sensual-rhythm', 'standard', 'connected', 3, ['Guided Rhythm', 'Hands-On', 'Responsive', 'Close']],
  ['ip122', 'The Undercurrent', 'Low Grinding Rhythm', 'sensual-rhythm', 'standard', 'sensual', 3, ['Low Rhythm', 'Grinding', 'Slow Burn', 'Close']],
  ['ip123', 'The Rise', 'Hip-Lift Support', 'sensual-rhythm', 'standard', 'heated', 3, ['Hip Lift', 'Supported', 'Open', 'Focused']],
  ['ip124', 'The Lower Flame', 'Low Close Missionary', 'deep-connection', 'low-mobility', 'intimate', 2, ['Face-to-Face', 'Low and Close', 'Classic', 'Slow']],
  ['ip125', 'The Surface', 'Tabletop Recline', 'exploratory', 'standard', 'heated', 3, ['Tabletop', 'Reclined', 'Open', 'Exploratory']],
  ['ip126', 'The Angle', 'Pillow Under Hips', 'sensual-rhythm', 'standard', 'focused', 3, ['Pillow-Supported', 'Angle', 'Hips Lifted', 'Classic']],
  ['ip127', 'The Frame', 'Hands at Waist Guidance', 'sensual-rhythm', 'standard', 'attentive', 3, ['Hands-On', 'Guided', 'Waist Hold', 'Responsive']],
  ['ip128', 'The Open Rhythm', 'Knees-Wide Recline', 'sensual-rhythm', 'standard', 'open', 3, ['Reclined', 'Open', 'Knees Wide', 'Supported']],
  ['ip129', 'The Soft Pressure', 'Slow Deep Contact', 'deep-connection', 'standard', 'intimate', 3, ['Slow', 'Deep Contact', 'Close', 'Grounded']],
  ['ip130', 'The Steady Beat', 'Consistent Rhythm', 'sensual-rhythm', 'standard', 'steady', 2, ['Rhythm', 'Consistent', 'Slow', 'Connected']],
  ['ip131', 'The Rolling Tide', 'Rocking Side Position', 'sensual-rhythm', 'low-mobility', 'gentle', 2, ['Side-Lying', 'Rocking', 'Gentle', 'Rhythm']],
  ['ip132', 'The Meridian', 'Diagonal Body Angle', 'exploratory', 'standard', 'curious', 3, ['Diagonal', 'Angled', 'Exploratory', 'Responsive']],
  ['ip133', 'The Lifted Pearl', 'Hip Elevation', 'sensual-rhythm', 'standard', 'heated', 3, ['Hips Elevated', 'Supported', 'Focused', 'Open']],
  ['ip134', 'The Close Current', 'Chest-to-Chest Rhythm', 'deep-connection', 'standard', 'connected', 2, ['Chest-to-Chest', 'Rhythm', 'Close', 'Slow']],

  ['ip135', 'The Tease', 'Over-Clothes Lap Sit', 'playful-energy', 'low-mobility', 'flirty', 1, ['Lap Sit', 'Flirty', 'Playful', 'Low Effort']],
  ['ip136', 'The Dare', 'Standing Kiss Hold', 'playful-energy', 'standard', 'playful', 2, ['Standing', 'Kissing', 'Playful', 'Close']],
  ['ip137', 'The Spin', 'Turnaround Riding', 'playful-energy', 'standard', 'confident', 3, ['Top Control', 'Turnaround', 'Playful', 'Confident']],
  ['ip138', 'The Laughing Fire', 'Playful Lap Straddle', 'playful-energy', 'standard', 'playful', 2, ['Lap Straddle', 'Playful', 'Seated', 'Close']],
  ['ip139', 'The Couch Chase', 'Edge-of-Couch Play', 'playful-energy', 'standard', 'flirty', 2, ['Couch', 'Edge-Supported', 'Playful', 'Flirty']],
  ['ip140', 'The Wink', 'Flirty Chair Sit', 'playful-energy', 'standard', 'flirty', 2, ['Chair', 'Flirty', 'Seated', 'Playful']],
  ['ip141', 'The Game', 'Guided Touch Challenge', 'playful-energy', 'low-mobility', 'playful', 2, ['Guided Touch', 'Game', 'Interactive', 'Playful']],
  ['ip142', 'The Lead Switch', 'Taking Turns Leading', 'playful-energy', 'standard', 'mutual', 3, ['Switching', 'Mutual', 'Interactive', 'Rhythm']],
  ['ip143', 'The Surprise', 'Blindfolded Touch Position', 'trust-vulnerability', 'low-mobility', 'curious', 3, ['Blindfold', 'Touch', 'Trust', 'Slow']],
  ['ip144', 'The Sparkler', 'Quick Standing Hold', 'playful-energy', 'active', 'charged', 2, ['Standing', 'Quick', 'Playful', 'Charged']],
  ['ip145', 'The Pillow Fight', 'Playful Bed Tangle', 'playful-energy', 'low-mobility', 'playful', 1, ['Bed Tangle', 'Playful', 'Soft', 'Low Effort']],
  ['ip146', 'The Flirt', 'Side-by-Side Teasing', 'playful-energy', 'low-mobility', 'flirty', 2, ['Side-by-Side', 'Teasing', 'Flirty', 'Gentle']],
  ['ip147', 'The Carousel', 'Changing Angles Slowly', 'exploratory', 'standard', 'curious', 3, ['Changing Angles', 'Exploratory', 'Slow', 'Responsive']],
  ['ip148', 'The Spotlight', 'One Partner Leads', 'trust-vulnerability', 'standard', 'confident', 3, ['One Leads', 'Confident', 'Guided', 'Interactive']],
  ['ip149', 'The Laughing Kiss', 'Tickle-to-Kiss Hold', 'playful-energy', 'low-mobility', 'playful', 1, ['Kissing', 'Playful', 'Gentle', 'Low Effort']],
  ['ip150', 'The Secret', 'Hidden Touch Cuddle', 'playful-energy', 'low-mobility', 'flirty', 2, ['Cuddle', 'Hidden Touch', 'Flirty', 'Close']],
  ['ip151', 'The Dance', 'Standing Sway', 'playful-energy', 'standard', 'romantic', 2, ['Standing', 'Sway', 'Romantic', 'Playful']],
];

function supportLevel(accessibility) {
  if (accessibility === 'low-mobility') return 'More Support';
  if (accessibility === 'active') return 'Less Support';
  return 'Moderate Support';
}

function energyForHeat(heat) {
  if (heat <= 1) return 'Warm';
  if (heat === 2) return 'Warm to Heated';
  return 'Heated';
}

function paceForHeat(heat) {
  if (heat <= 1) return 'Slow';
  if (heat === 2) return 'Slow to Moderate';
  return 'Moderate';
}

function durationForHeat(heat) {
  if (heat <= 1) return '10–20 min';
  if (heat === 2) return '10–15 min';
  return '5–15 min';
}

function makePosition(row, index) {
  const [id, title, commonName, category, accessibility, mood, heat, styleTags] = row;

  return {
    id,
    title,
    commonName,
    category,
    duration: durationForHeat(heat),
    accessibility,
    mood,
    heat,
    premium: true,
    releaseWeek: 91 + index,
    focus: `${title} is a guided intimacy position built around ${mood} connection, comfort, and shared attention. It adds a fresh option for couples who want variety without making the experience feel rushed, clinical, or performance-driven.`,
    howTo: `Settle into ${commonName.toLowerCase()} slowly, using pillows, a wall, the bed, a couch, or another stable surface if support helps. Let both partners find a comfortable shape first, then build through breath, closeness, pressure, and small adjustments rather than forcing a fixed pose.`,
    benefits: `This position adds variety while keeping the Between Us tone connected, tasteful, and couple-centered. It gives partners a clear idea to try while still leaving room for different bodies, energy levels, and comfort needs.`,
    makeItHotter: `Increase closeness before increasing speed. Use eye contact, kissing, hand placement, slower rhythm, or brief pauses to make the moment feel more intentional. Small changes in angle, pressure, or support usually matter more than dramatic movement.`,
    comfort: `Comfort comes first. Use cushions where needed, adjust the angle early, and pause if anything feels strained. This position should feel supported, responsive, and mutually wanted — not forced.`,
    styleTags,
    supportLevel: supportLevel(accessibility),
    energy: energyForHeat(heat),
    pace: paceForHeat(heat),
    bestFor: `${commonName}, ${mood} energy, guided connection, and a position that feels easy to personalize.`,
    whyPeopleLikeIt: `People may like this because it gives the moment a clear shape while still feeling personal, flexible, and emotionally connected. It is designed to feel more like a shared experience than a generic position card.`,
    goodFor: [
      'Trying something guided',
      'Building connection',
      'Exploring a new angle or rhythm',
      'Staying attentive to comfort',
      'Making intimacy feel intentional'
    ],
    lessIdealIf: [
      'Either partner feels physically strained',
      'The setup does not feel stable',
      'You want a very different mood than this card suggests'
    ],
    setupTips: [
      'Start slower than you think you need to',
      'Use pillows or nearby support if helpful',
      'Adjust comfort before adjusting pace',
      'Let both partners give feedback',
      'Stop and reset if the position feels awkward'
    ],
    moodWords: [
      mood.charAt(0).toUpperCase() + mood.slice(1),
      'Connected',
      'Intentional',
      'Responsive',
      heat >= 3 ? 'Heated' : 'Soft'
    ],
    shortSummary: `${title} is a ${mood}, guided variation of ${commonName.toLowerCase()} designed for comfort, connection, and shared rhythm.`,
    chips: styleTags.slice(0, 4),
  };
}

const batch = rawBatch.map(makePosition);

const duplicateIds = batch.filter((item) => existingIds.has(item.id)).map((item) => item.id);
const duplicateTitles = batch.filter((item) => existingTitles.has(item.title)).map((item) => item.title);

if (duplicateIds.length > 0 || duplicateTitles.length > 0) {
  console.error('Batch has conflicts. No changes made.');
  if (duplicateIds.length > 0) console.error('Duplicate IDs:', duplicateIds.join(', '));
  if (duplicateTitles.length > 0) console.error('Duplicate titles:', duplicateTitles.join(', '));
  process.exit(1);
}

data.items = [...items, ...batch];
data.meta = {
  ...(data.meta || {}),
  totalPositions: data.items.length,
};

fs.writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n');

console.log(`Added ${batch.length} positions to ${targetPath}`);
console.log(`New total: ${data.items.length}`);
console.log(`Added IDs: ${batch.map((item) => item.id).join(', ')}`);
