const fs = require('fs');

const targetPath = process.argv[2] || 'content/intimacyPositions.js';

if (!fs.existsSync(targetPath)) {
  console.error(`Could not find file: ${targetPath}`);
  console.error('Run again with the real path, for example:');
  console.error('node scripts/addIntimacyPositionsBatch1.cjs data/intimacyPositions.js');
  process.exit(1);
}

const source = fs.readFileSync(targetPath, 'utf8');

const itemsMatch = source.match(/[\"']?items[\"']?\s*:\s*\[/);
if (!itemsMatch) {
  console.error('Could not find an items: [ array in this file.');
  process.exit(1);
}

const arrayOpenIndex = itemsMatch.index + itemsMatch[0].lastIndexOf('[');

function findMatchingBracket(text, openIndex) {
  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      quote = char;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

const arrayCloseIndex = findMatchingBracket(source, arrayOpenIndex);
if (arrayCloseIndex === -1) {
  console.error('Could not find the closing ] for items array.');
  process.exit(1);
}

const existingIds = new Set([...source.matchAll(/id\s*:\s*["'](ip\d+)["']/g)].map((m) => m[1]));

const rawBatch = [
  ['ip051', 'The Anchor', 'Pillow Missionary', 'deep-connection', 'low-mobility', 'tender', 2, ['Face-to-Face', 'Pillow-Supported', 'Classic', 'Slow']],
  ['ip052', 'The Slow Burn', 'Coital Alignment', 'sensual-rhythm', 'standard', 'sensual', 3, ['Face-to-Face', 'Rhythm', 'Body Contact', 'Slow Burn']],
  ['ip053', 'The Fold', 'Butterfly Edge Recline', 'sensual-rhythm', 'standard', 'heated', 3, ['Edge-Supported', 'Open', 'Reclined', 'Focused']],
  ['ip054', 'The Lantern', 'Chair Face-to-Face', 'deep-connection', 'standard', 'intimate', 2, ['Chair', 'Face-to-Face', 'Seated', 'Close']],
  ['ip055', 'The Drift', 'Lazy Spooning', 'deep-connection', 'low-mobility', 'cozy', 1, ['Spooning', 'Low Effort', 'Cozy', 'Slow']],
  ['ip056', 'The Knot', 'Side-Lying Leg Over Hip', 'deep-connection', 'low-mobility', 'intimate', 2, ['Side-Lying', 'Leg Wrap', 'Gentle', 'Connected']],
  ['ip057', 'The Ember', 'Legs Wrapped Missionary', 'deep-connection', 'standard', 'warm', 3, ['Face-to-Face', 'Wrapped', 'Classic', 'Close']],
  ['ip058', 'The Threshold', 'Standing Against Wall', 'trust-vulnerability', 'active', 'passionate', 3, ['Standing', 'Wall-Supported', 'Held', 'Passionate']],
  ['ip059', 'The Bend', 'Bent Over Bed', 'sensual-rhythm', 'standard', 'heated', 3, ['Rear Entry', 'Edge-Supported', 'Grounded', 'Direct']],
  ['ip060', 'The Nest', 'Pillow-Supported Prone', 'deep-connection', 'low-mobility', 'grounded', 2, ['Prone', 'Pillow-Supported', 'Low Effort', 'Warm']],
  ['ip061', 'The Spark', 'Seated Oral', 'playful-energy', 'standard', 'playful', 3, ['Oral', 'Seated', 'Playful', 'Attentive']],
  ['ip062', 'The Offering', 'Reclined Receiving', 'trust-vulnerability', 'low-mobility', 'attentive', 2, ['Receiving', 'Reclined', 'Devotional', 'Supported']],
  ['ip063', 'The Current', 'Standing One-Leg Raised', 'exploratory', 'active', 'adventurous', 3, ['Standing', 'One Leg Raised', 'Wall-Supported', 'Exploratory']],
  ['ip064', 'The Halo', 'Legs Around Waist', 'deep-connection', 'standard', 'intimate', 3, ['Face-to-Face', 'Leg Wrap', 'Close', 'Classic']],
  ['ip065', 'The Turn', 'Sideways Edge of Bed', 'exploratory', 'standard', 'curious', 3, ['Edge-Supported', 'Side Angle', 'Open', 'Exploratory']],
  ['ip066', 'The Hush', 'Stillness Hold', 'deep-connection', 'low-mobility', 'tender', 1, ['Stillness', 'Emotional', 'Slow', 'Low Effort']],
  ['ip067', 'The Flame', 'Kneeling Face-to-Face', 'trust-vulnerability', 'standard', 'passionate', 3, ['Kneeling', 'Face-to-Face', 'Close', 'Held']],
  ['ip068', 'The Ribbon', 'One Leg Over Shoulder', 'sensual-rhythm', 'standard', 'heated', 3, ['Leg Lift', 'Supported', 'Focused', 'Open']],
  ['ip069', 'The Orbit', 'Circular Riding Motion', 'playful-energy', 'standard', 'confident', 3, ['Top Control', 'Circular Rhythm', 'Playful', 'Responsive']],
  ['ip070', 'The Afterglow', 'Post-Intimacy Hold', 'deep-connection', 'low-mobility', 'soft', 1, ['Aftercare', 'Cuddle', 'Low Effort', 'Tender']],
  ['ip071', 'The Vow', 'Chest-to-Chest Stillness', 'deep-connection', 'low-mobility', 'devoted', 1, ['Chest-to-Chest', 'Stillness', 'Emotional', 'Slow']],
  ['ip072', 'The Promise', 'Forehead-to-Forehead Hold', 'deep-connection', 'low-mobility', 'tender', 1, ['Forehead Touch', 'Emotional', 'Gentle', 'Present']],
  ['ip073', 'The Hearth', 'Reclined Lap Hold', 'deep-connection', 'standard', 'warm', 2, ['Lap', 'Reclined', 'Close', 'Warm']],
  ['ip074', 'The Bloom', 'Soft Missionary', 'deep-connection', 'low-mobility', 'romantic', 2, ['Face-to-Face', 'Classic', 'Soft', 'Slow']],
  ['ip075', 'The Sanctuary', 'Full-Body Embrace', 'deep-connection', 'low-mobility', 'safe', 1, ['Full Contact', 'Embrace', 'Grounded', 'Tender']],
  ['ip076', 'The Pulse', 'Slow Face-to-Face Rocking', 'sensual-rhythm', 'standard', 'intimate', 2, ['Face-to-Face', 'Rocking', 'Slow', 'Rhythm']],
  ['ip077', 'The Devoted Hold', 'Seated Embrace', 'deep-connection', 'standard', 'attentive', 2, ['Seated', 'Embrace', 'Close', 'Emotional']],
  ['ip078', 'The Golden Hour', 'Side Face-to-Face Leg Wrap', 'deep-connection', 'low-mobility', 'soft', 2, ['Side-Lying', 'Face-to-Face', 'Leg Wrap', 'Gentle']],
  ['ip079', 'The Quiet Flame', 'Hands-Held Missionary', 'deep-connection', 'standard', 'romantic', 2, ['Hands Held', 'Face-to-Face', 'Classic', 'Tender']],
  ['ip080', 'The Belonging', 'Wrapped Leg Missionary', 'deep-connection', 'standard', 'intimate', 3, ['Wrapped', 'Face-to-Face', 'Close', 'Warm']],
  ['ip081', 'The Keepsake', 'Slow Kiss Hold', 'deep-connection', 'low-mobility', 'tender', 1, ['Kissing', 'Stillness', 'Gentle', 'Emotional']],
  ['ip082', 'The Nearness', 'Chest-to-Chest Recline', 'deep-connection', 'low-mobility', 'warm', 2, ['Reclined', 'Chest-to-Chest', 'Slow', 'Connected']],
  ['ip083', 'The Open Door', 'Kneeling Face-to-Face', 'trust-vulnerability', 'standard', 'open', 3, ['Kneeling', 'Face-to-Face', 'Open', 'Held']],
  ['ip084', 'The Harbor', 'Supported Eye Contact Hold', 'deep-connection', 'low-mobility', 'safe', 1, ['Eye Contact', 'Supported', 'Stillness', 'Tender']],
  ['ip085', 'The Sacred Pause', 'Stillness Inside Closeness', 'deep-connection', 'low-mobility', 'vulnerable', 1, ['Stillness', 'Presence', 'Emotional', 'Slow']],
  ['ip086', 'The Return', 'Reunion Hold', 'deep-connection', 'standard', 'warm', 2, ['Reunion', 'Embrace', 'Close', 'Tender']],
  ['ip087', 'The First Light', 'Morning Side Cuddle', 'deep-connection', 'low-mobility', 'cozy', 1, ['Morning', 'Side-Lying', 'Cuddle', 'Soft']],
  ['ip088', 'The Thread', 'Interlaced Legs', 'deep-connection', 'standard', 'intimate', 2, ['Leg Tangle', 'Face-to-Face', 'Connected', 'Slow']],
  ['ip089', 'The Meeting Place', 'Face-to-Face Pillow Support', 'deep-connection', 'low-mobility', 'gentle', 2, ['Pillow-Supported', 'Face-to-Face', 'Soft', 'Close']],
  ['ip090', 'The Soft Landing', 'Reclined Embrace', 'deep-connection', 'low-mobility', 'soft', 1, ['Reclined', 'Embrace', 'Low Effort', 'Tender']],
  ['ip091', 'The Holding Pattern', 'Partner-on-Top Hug', 'deep-connection', 'standard', 'close', 2, ['Top Partner', 'Hug', 'Close', 'Slow']],
  ['ip092', 'The Moonlit Hold', 'Side Cuddle with Touch', 'deep-connection', 'low-mobility', 'cozy', 1, ['Side Cuddle', 'Touch', 'Soft', 'Low Effort']],
  ['ip093', 'The Blanket', 'Fully Wrapped Spooning', 'deep-connection', 'low-mobility', 'protected', 1, ['Spooning', 'Wrapped', 'Cozy', 'Safe']],
  ['ip094', 'The Lullaby', 'Slow Side-Lying Rhythm', 'sensual-rhythm', 'low-mobility', 'sleepy', 1, ['Side-Lying', 'Slow Rhythm', 'Gentle', 'Cozy']],
  ['ip095', 'The Warm Room', 'Reclined Cuddle', 'deep-connection', 'low-mobility', 'warm', 1, ['Reclined', 'Cuddle', 'Low Effort', 'Soft']],
  ['ip096', 'The Sunday', 'Lazy Morning Hold', 'deep-connection', 'low-mobility', 'cozy', 1, ['Morning', 'Lazy', 'Cuddle', 'Soft']],
  ['ip097', 'The Low Tide', 'Side-by-Side Gentle Rock', 'sensual-rhythm', 'low-mobility', 'gentle', 1, ['Side-by-Side', 'Rocking', 'Gentle', 'Slow']],
  ['ip098', 'The Cloud', 'Pillow Nest', 'deep-connection', 'low-mobility', 'soft', 1, ['Pillows', 'Nest', 'Low Effort', 'Cozy']],
  ['ip099', 'The Lantern Glow', 'Soft Oral Support', 'trust-vulnerability', 'low-mobility', 'attentive', 2, ['Oral', 'Supported', 'Soft', 'Attentive']],
  ['ip100', 'The Quiet Nest', 'Prone Pillow Hug', 'deep-connection', 'low-mobility', 'grounded', 2, ['Prone', 'Pillow-Supported', 'Hug', 'Grounded']],
];

function supportLevel(accessibility) {
  if (accessibility === 'low-mobility') return 'More Support';
  if (accessibility === 'active') return 'Moderate Support';
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

function makePosition(row, index) {
  const [id, title, commonName, category, accessibility, mood, heat, styleTags] = row;
  const chips = styleTags.slice(0, 4);
  const releaseWeek = 41 + index;

  return {
    id,
    title,
    commonName,
    category,
    duration: heat <= 1 ? '10–20 min' : '10–15 min',
    accessibility,
    mood,
    heat,
    premium: true,
    releaseWeek,
    focus: `${title} is a guided intimacy position built around ${mood} connection, comfort, and shared attention. It gives couples another way to explore closeness without making the experience feel rushed, clinical, or performance-driven.`,
    howTo: `Settle into ${commonName.toLowerCase()} slowly, using pillows, a wall, the bed, or a stable surface if support helps. Let both partners find a comfortable angle first, then build movement gradually through breath, pressure, and small adjustments rather than forcing a fixed shape.`,
    benefits: `This position adds variety while still fitting the Between Us tone: connected, premium, and couple-centered. It gives partners a clear structure to try, while leaving enough flexibility for different bodies, moods, and comfort levels.`,
    makeItHotter: `Increase closeness before increasing speed. Use eye contact, kissing, hand placement, slower rhythm, or brief pauses to make the moment feel more intentional and charged. Small angle changes usually matter more than dramatic movement.`,
    comfort: `Comfort comes first. Use cushions where needed, adjust the angle early, and pause if anything feels strained. This position should feel supported and responsive, not forced.`,
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
      'Making intimacy feel intentional',
    ],
    lessIdealIf: [
      'Either partner feels physically strained',
      'The setup does not feel stable',
      'You want a very different mood than this card suggests',
    ],
    setupTips: [
      'Start slower than you think you need to',
      'Use pillows or nearby support if helpful',
      'Adjust comfort before adjusting pace',
      'Let both partners give feedback',
      'Stop and reset if the position feels awkward',
    ],
    moodWords: [
      mood.charAt(0).toUpperCase() + mood.slice(1),
      'Connected',
      'Intentional',
      'Responsive',
      heat >= 3 ? 'Heated' : 'Soft',
    ],
    shortSummary: `${title} is a ${mood}, guided variation of ${commonName.toLowerCase()} designed for comfort, connection, and shared rhythm.`,
    chips,
  };
}

const batch = rawBatch.map(makePosition).filter((item) => !existingIds.has(item.id));

if (batch.length === 0) {
  console.log('No new positions added. All batch IDs already exist.');
  process.exit(0);
}

const insertText = `,\n${batch
  .map((item) => `    ${JSON.stringify(item, null, 6).replace(/\n/g, '\n    ')}`)
  .join(',\n')}`;

const updated = source.slice(0, arrayCloseIndex) + insertText + source.slice(arrayCloseIndex);

fs.writeFileSync(targetPath, updated);

console.log(`Added ${batch.length} positions to ${targetPath}`);
console.log(`Added IDs: ${batch.map((item) => item.id).join(', ')}`);
