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
  ['ip152', 'The Pulse Check', 'Tell-Me-More Touch', 'playful-energy', 'low-mobility', 'playful', 2, ['Guided Touch', 'Feedback', 'Playful', 'Interactive']],
  ['ip153', 'The Mischief', 'Couch Straddle', 'playful-energy', 'standard', 'flirty', 2, ['Couch', 'Straddle', 'Playful', 'Close']],
  ['ip154', 'The Invitation', 'Come-Sit-With-Me', 'playful-energy', 'low-mobility', 'flirty', 2, ['Lap Sit', 'Invitation', 'Flirty', 'Seated']],
  ['ip155', 'The Play Button', 'Timed Touch Game', 'playful-energy', 'low-mobility', 'playful', 2, ['Timed', 'Touch Game', 'Interactive', 'Playful']],
  ['ip156', 'The Spark Line', 'Light Touch Trail', 'playful-energy', 'low-mobility', 'teasing', 2, ['Light Touch', 'Teasing', 'Slow', 'Sensual']],
  ['ip157', 'The Show-Off', 'Confident Top Pose', 'playful-energy', 'standard', 'confident', 3, ['Top Control', 'Confident', 'Open', 'Playful']],
  ['ip158', 'The Encore', 'Repeat Favorite Position', 'playful-energy', 'standard', 'familiar', 3, ['Favorite', 'Repeat', 'Responsive', 'Warm']],

  ['ip159', 'The Surrender', 'Supported Recline', 'trust-vulnerability', 'low-mobility', 'vulnerable', 2, ['Supported', 'Reclined', 'Trust', 'Slow']],
  ['ip160', 'The Held', 'Lifted Leg Support', 'trust-vulnerability', 'standard', 'held', 3, ['Leg Support', 'Held', 'Open', 'Trust']],
  ['ip161', 'The Trust Fall', 'Back-to-Chest Hold', 'trust-vulnerability', 'low-mobility', 'safe', 1, ['Back-to-Chest', 'Held', 'Stillness', 'Safe']],
  ['ip162', 'The Open Palm', 'Guided Hands', 'trust-vulnerability', 'low-mobility', 'attentive', 2, ['Guided Hands', 'Trust', 'Responsive', 'Soft']],
  ['ip163', 'The Covered Shelter', 'Partner Covers Partner', 'trust-vulnerability', 'low-mobility', 'protected', 2, ['Covered', 'Full Contact', 'Protective', 'Slow']],
  ['ip164', 'The Permission', 'Slow Consent Pause', 'trust-vulnerability', 'low-mobility', 'safe', 1, ['Consent', 'Pause', 'Stillness', 'Safe']],
  ['ip165', 'The Release', 'Fully Supported Back Recline', 'trust-vulnerability', 'low-mobility', 'soft', 2, ['Back Recline', 'Supported', 'Open', 'Slow']],
  ['ip166', 'The Wall Lean', 'Wall-Supported Embrace', 'trust-vulnerability', 'standard', 'close', 2, ['Wall-Supported', 'Embrace', 'Standing', 'Close']],
  ['ip167', 'The Safe Word', 'Check-In Position', 'trust-vulnerability', 'low-mobility', 'safe', 1, ['Check-In', 'Consent', 'Slow', 'Trust']],
  ['ip168', 'The Witness', 'Eye Contact Stillness', 'trust-vulnerability', 'low-mobility', 'vulnerable', 1, ['Eye Contact', 'Stillness', 'Vulnerable', 'Present']],
  ['ip169', 'The Guided Flame', 'One Partner Directs', 'trust-vulnerability', 'standard', 'guided', 3, ['One Leads', 'Guided', 'Trust', 'Responsive']],
  ['ip170', 'The Soft Edge', 'Gentle Restraint-Inspired Hold', 'trust-vulnerability', 'standard', 'edgy', 2, ['Held', 'Boundaries', 'Trust', 'Slow']],
  ['ip171', 'The Keeper', 'Protective Spooning', 'trust-vulnerability', 'low-mobility', 'protected', 1, ['Spooning', 'Protective', 'Safe', 'Close']],
  ['ip172', 'The Handhold', 'Hands Interlaced Missionary', 'deep-connection', 'standard', 'romantic', 2, ['Hands Held', 'Face-to-Face', 'Classic', 'Tender']],
  ['ip173', 'The Letting Go', 'Reclined Pillow Support', 'trust-vulnerability', 'low-mobility', 'soft', 2, ['Reclined', 'Pillow-Supported', 'Release', 'Soft']],
  ['ip174', 'The Trust Line', 'Partner Holds Hips', 'trust-vulnerability', 'standard', 'held', 3, ['Hip Hold', 'Guided', 'Trust', 'Connected']],
  ['ip175', 'The Open Window', 'Legs Supported Open', 'trust-vulnerability', 'standard', 'open', 3, ['Leg Support', 'Open', 'Reclined', 'Held']],
  ['ip176', 'The Brave Place', 'Vulnerable Face-to-Face Hold', 'trust-vulnerability', 'low-mobility', 'vulnerable', 2, ['Face-to-Face', 'Vulnerable', 'Stillness', 'Held']],
  ['ip177', 'The Slow Yes', 'Gradual Closeness', 'trust-vulnerability', 'low-mobility', 'safe', 1, ['Gradual', 'Consent', 'Slow', 'Soft']],
  ['ip178', 'The Full Weight', 'Body-Pressure Hold', 'trust-vulnerability', 'low-mobility', 'grounded', 2, ['Body Pressure', 'Full Contact', 'Grounded', 'Held']],
  ['ip179', 'The Guardrail', 'Wall Support', 'trust-vulnerability', 'standard', 'steady', 2, ['Wall-Supported', 'Standing', 'Steady', 'Supported']],
  ['ip180', 'The Cradled Flame', 'Partner-Supported Lap Seat', 'trust-vulnerability', 'standard', 'held', 2, ['Lap Seat', 'Supported', 'Held', 'Close']],
  ['ip181', 'The Yield', 'Soft Supported Stillness', 'trust-vulnerability', 'low-mobility', 'soft', 1, ['Supported', 'Stillness', 'Yielding', 'Soft']],

  ['ip182', 'The Compass Rose', 'Diagonal Edge Position', 'exploratory', 'standard', 'curious', 3, ['Diagonal', 'Edge-Supported', 'Exploratory', 'Open']],
  ['ip183', 'The High Tide', 'Elevated Hips', 'exploratory', 'standard', 'heated', 3, ['Hips Elevated', 'Supported', 'Open', 'Focused']],
  ['ip184', 'The Stair Step', 'Step-Supported Standing', 'exploratory', 'active', 'adventurous', 3, ['Standing', 'Step-Supported', 'Adventurous', 'Active']],
  ['ip185', 'The Counter', 'Countertop Recline', 'exploratory', 'standard', 'heated', 3, ['Countertop', 'Reclined', 'Open', 'Exploratory']],
  ['ip186', 'The Skyline', 'Standing Rear Support', 'exploratory', 'active', 'charged', 3, ['Standing', 'Rear Support', 'Active', 'Heated']],
  ['ip187', 'The Frame Shift', 'Sideways Straddle', 'exploratory', 'standard', 'curious', 3, ['Sideways', 'Straddle', 'Exploratory', 'Responsive']],
  ['ip188', 'The Crosscurrent', 'Cross-Leg Angle', 'exploratory', 'standard', 'curious', 3, ['Cross-Leg', 'Angled', 'Exploratory', 'Focused']],
  ['ip189', 'The Pivot', 'Rotated Missionary', 'exploratory', 'standard', 'curious', 3, ['Rotated', 'Face-to-Face', 'Angled', 'Exploratory']],
  ['ip190', 'The Bed Ledge', 'Bed-Edge Lift', 'exploratory', 'standard', 'heated', 3, ['Bed Edge', 'Lifted', 'Supported', 'Open']],
  ['ip191', 'The Vault', 'Supported Standing Lift', 'exploratory', 'active', 'adventurous', 3, ['Standing Lift', 'Supported', 'Active', 'Held']],
  ['ip192', 'The Crescent', 'One Leg Hooked', 'exploratory', 'standard', 'heated', 3, ['One Leg Hooked', 'Open', 'Angled', 'Supported']],
  ['ip193', 'The Switchback', 'Alternating Front and Side', 'exploratory', 'standard', 'playful', 3, ['Alternating', 'Front and Side', 'Exploratory', 'Responsive']],
  ['ip194', 'The Overlook', 'Bent Over Surface', 'exploratory', 'standard', 'heated', 3, ['Bent Over', 'Surface-Supported', 'Grounded', 'Direct']],
  ['ip195', 'The Climb', 'Kneeling Upright', 'exploratory', 'standard', 'passionate', 3, ['Kneeling', 'Upright', 'Close', 'Heated']],
  ['ip196', 'The Open Frame', 'Supported Wide-Leg Recline', 'exploratory', 'standard', 'open', 3, ['Wide-Leg', 'Reclined', 'Supported', 'Open']],
  ['ip197', 'The Tandem', 'Seated Side Straddle', 'exploratory', 'standard', 'curious', 3, ['Seated', 'Side Straddle', 'Exploratory', 'Close']],
  ['ip198', 'The Side Door', 'Side Entry', 'exploratory', 'standard', 'curious', 3, ['Side Entry', 'Angled', 'Exploratory', 'Responsive']],
  ['ip199', 'The Wildcard', 'Choose-Your-Angle Position', 'exploratory', 'standard', 'adventurous', 3, ['Choose Angle', 'Exploratory', 'Customizable', 'Playful']],
  ['ip200', 'The Rooftop', 'High Surface Recline', 'exploratory', 'standard', 'heated', 3, ['High Surface', 'Reclined', 'Open', 'Adventurous']],
  ['ip201', 'The Final Spark', 'Favorite Finish Hold', 'deep-connection', 'low-mobility', 'afterglow', 1, ['Aftercare', 'Favorite', 'Cuddle', 'Tender']],
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
    releaseWeek: 141 + index,
    focus: `${title} is a guided intimacy position built around ${mood} connection, comfort, and shared attention. It expands the library with another couple-centered option that feels intentional, tasteful, and easy to personalize.`,
    howTo: `Settle into ${commonName.toLowerCase()} gradually, using pillows, a wall, the bed, a couch, a chair, or another stable surface if support helps. Find the safest and most comfortable shape first, then build through breath, closeness, pressure, and small adjustments rather than forcing a fixed pose.`,
    benefits: `This position adds variety while keeping the Between Us tone connected, premium, and supportive. It gives couples a guided idea to try while still leaving room for different bodies, energy levels, boundaries, and comfort needs.`,
    makeItHotter: `Increase intention before intensity. Use eye contact, kissing, hand placement, slower rhythm, guided touch, or a brief pause to make the moment feel more connected. Small changes in angle, support, or closeness usually matter more than dramatic movement.`,
    comfort: `Comfort and consent come first. Use cushions where needed, adjust the angle early, and pause if anything feels strained, unstable, or emotionally off. This position should feel supported, responsive, and mutually wanted — not forced.`,
    styleTags,
    supportLevel: supportLevel(accessibility),
    energy: energyForHeat(heat),
    pace: paceForHeat(heat),
    bestFor: `${commonName}, ${mood} energy, guided connection, and a position that can be adapted to the couple's comfort level.`,
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
      'Either partner wants to pause or change direction'
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
