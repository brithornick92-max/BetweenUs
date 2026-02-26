// scripts/add-depth-mood.cjs
// Assigns depth and mood to every prompt in content/prompts.json
// based on thorough text analysis, heat level, and category.

const fs = require('fs');
const path = require('path');

const PROMPTS_PATH = path.join(__dirname, '..', 'content', 'prompts.json');
const data = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf-8'));

// ═══════════════════════════════════════════════════════════════
// DEPTH: "light" | "meaningful" | "deep"
//   light      — Fun, lighthearted, surface-level
//   meaningful — Thoughtful connection, requires reflection
//   deep       — Vulnerable, intimate, emotionally intense
// ═══════════════════════════════════════════════════════════════

const DEEP_KEYWORDS = [
  'vulnerable', 'vulnerability', 'afraid', 'fear', 'scared', 'terrif',
  'insecuri', 'shame', 'regret', 'forgive', 'forgiveness', 'grief', 'loss',
  'darkest', 'deepest', 'most painful', 'most difficult', 'hardest',
  'cry', 'cried', 'tears', 'weep', 'broke', 'broken',
  'trauma', 'wound', 'heal', 'struggle', 'suffering',
  'soul', 'soulmate', 'destiny', 'purpose', 'meaning of',
  'die', 'death', 'dying', 'mortal', 'last day', 'final',
  'surrender', 'completely', 'fully', 'unconditional',
  'sacred', 'worship', 'devote', 'devotion', 'eternal',
  'confess', 'confession', 'admit', 'secret that',
  'what scares you', 'what terrifies', 'what haunts',
  'never told', 'no one knows', 'haven\'t shared',
  'changed who you are', 'transform', 'breaking point',
  'raw', 'unfiltered', 'stripped', 'bare',
  'most intimate', 'unrestrained', 'primal', 'intense',
  'wildest', 'darkest fantasy', 'deepest desire', 'forbidden',
  'taboo', 'boundary', 'limits', 'edge', 'completely let go',
  'surrender control', 'total trust', 'blindfold', 'tied',
  'dominate', 'submit', 'submissive', 'dominant',
  'beg', 'begging', 'desperate', 'craving',
  'consume', 'devour', 'ravish', 'possess',
  'all night', 'can\'t stop', 'lose control', 'lose yourself',
  'overwhelm', 'drown', 'melt', 'tremble', 'shatter',
];

const LIGHT_KEYWORDS = [
  'favorite', 'favourite', 'funniest', 'funni', 'silly', 'goofy',
  'laugh', 'giggle', 'joke', 'prank', 'tease', 'tickle',
  'would you rather', 'would you prefer', 'pick one',
  'this or that', 'guess', 'bet', 'dare',
  'animal', 'pet', 'food', 'snack', 'meal', 'cook',
  'movie', 'show', 'song', 'playlist', 'music', 'dance party',
  'game', 'trivia', 'quiz', 'competition',
  'emoji', 'gif', 'meme', 'selfie', 'photo',
  'morning routine', 'coffee', 'breakfast', 'weekend',
  'vacation', 'travel', 'bucket list',
  'superpower', 'celebrity', 'fictional character',
  'nickname', 'pet name', 'inside joke',
  'first impression', 'first date', 'first thing you notice',
  'outfit', 'style', 'wardrobe', 'getting dressed',
  'flirt', 'wink', 'smirk', 'cheeky', 'playful',
  'cuddle', 'snuggle', 'spoon', 'hold hands',
  'ice cream', 'chocolate', 'pizza', 'wine',
  'random', 'quick', 'simple', 'easy', 'casual',
  'text message', 'good morning', 'goodnight',
  'surprise', 'gift', 'present', 'treat',
  'which of my', 'what\'s the first',
  'what makes you smile', 'what makes you laugh',
  'compliment', 'appreciate',
];

const MEANINGFUL_BOOST = [
  'important', 'value', 'believe', 'dream', 'goal', 
  'grow', 'growth', 'learn', 'lesson', 'taught',
  'relationship', 'partner', 'together', 'connect', 'connection',
  'trust', 'honest', 'honesty', 'communicate', 'communication',
  'understand', 'understanding', 'empathy', 'support',
  'love language', 'attachment', 'safe space', 'comfort zone',
  'grateful', 'gratitude', 'thankful', 'appreciate',
  'vision', 'future together', 'build', 'create',
  'tradition', 'ritual', 'routine', 'habit',
  'boundary', 'boundaries', 'respect', 'space',
  'fantasy', 'desire', 'want', 'need', 'crave',
  'explore', 'try', 'experiment', 'open to',
  'turn on', 'turns you on', 'attracted', 'attraction',
  'sensual', 'intimate moment', 'closer', 'proximity',
  'touch', 'kiss', 'embrace', 'body',
  'bedroom', 'romantic evening', 'date night',
  'pleasure', 'satisfy', 'enjoy',
];

function getDepth(prompt) {
  const text = prompt.text.toLowerCase();
  const heat = prompt.heat;

  let deepScore = 0;
  let lightScore = 0;
  let meaningfulScore = 0;

  // Keyword scoring
  for (const kw of DEEP_KEYWORDS) {
    if (text.includes(kw)) deepScore += 2;
  }
  for (const kw of LIGHT_KEYWORDS) {
    if (text.includes(kw)) lightScore += 1.5;
  }
  for (const kw of MEANINGFUL_BOOST) {
    if (text.includes(kw)) meaningfulScore += 1;
  }

  // ── Heat level is the primary structural signal ──────────────
  // Heat 1 (Comfort) = mostly light, some meaningful
  // Heat 2 (Spark) = mostly meaningful, some light
  // Heat 3 (Intimate) = meaningful
  // Heat 4 (Adventurous) = meaningful, some deep
  // Heat 5 (Passion) = meaningful default; only deep with emotional vulnerability
  if (heat === 1) {
    lightScore += 4;
    meaningfulScore += 1;
  } else if (heat === 2) {
    lightScore += 1;
    meaningfulScore += 4;
  } else if (heat === 3) {
    meaningfulScore += 4;
  } else if (heat === 4) {
    meaningfulScore += 3;
    deepScore += 1;
  } else if (heat === 5) {
    meaningfulScore += 3;
    // Only boost deep if the text has emotional vulnerability signals
    const hasEmotionalDepth = /vulnerab|surrender|trust|safe|soul|sacred|devot|unconditional|completely let go|lose yourself|spiritual|worship|confess|never told|transform|raw.*emotion|what.*mean.*to you/i.test(text);
    if (hasEmotionalDepth) {
      deepScore += 4;
    }
  }

  // Text length heuristic
  if (text.length > 120) {
    meaningfulScore += 1;
    if (text.length > 200) deepScore += 1;
  }
  if (text.length < 50) lightScore += 1;

  // Question complexity
  const questionMarks = (text.match(/\?/g) || []).length;
  if (questionMarks > 1) meaningfulScore += 1;

  // Ellipsis at end (conversational/reflective tone)
  if (text.endsWith('...') || text.endsWith('\u2026')) meaningfulScore += 0.5;

  // Specific text patterns for depth
  if (/what would you do if|how would you feel|what does .* mean to you/i.test(text)) {
    meaningfulScore += 2;
  }
  if (/describe in detail|walk me through|tell me about the time/i.test(text)) {
    meaningfulScore += 1;
    deepScore += 1;
  }
  if (/if we could|imagine|picture this|close your eyes/i.test(text)) {
    meaningfulScore += 1;
  }
  if (/most .*(moment|experience|memory|thing)/i.test(text)) {
    meaningfulScore += 1;
  }
  if (/never .*(forget|stop|leave|give up)/i.test(text)) {
    deepScore += 1;
  }

  // Emotional depth signals → deep
  if (/what scares you|what terrifies|biggest fear|most vulnerable|hardest thing|most painful|broke.*heart|changed.*forever|shaped who/i.test(text)) {
    deepScore += 3;
  }
  // "Real love" / "what love means" → meaningful, not light
  if (/real love|what.*love.*look|what.*love.*feel|what.*love.*mean/i.test(text)) {
    meaningfulScore += 3;
    lightScore -= 2;
  }
  // "Met again for the first time" type reflective prompts → meaningful
  if (/if we met|if you met|first time.*knowing|knowing what/i.test(text)) {
    meaningfulScore += 2;
    lightScore -= 1;
  }

  // Final decision
  if (deepScore > meaningfulScore && deepScore > lightScore) return 'deep';
  if (lightScore > meaningfulScore && lightScore > deepScore) return 'light';
  return 'meaningful';
}

// ═══════════════════════════════════════════════════════════════
// MOOD: 9 values from Chip.js
//   spicy       — Sexually suggestive, hot, provocative
//   romantic     — Love, romance, sweetness, tenderness  
//   heartfelt    — Emotional, sincere, touching, caring
//   adventurous  — Bold, exciting, trying new things, daring
//   cozy         — Comfortable, warm, safe, home
//   playful      — Fun, lighthearted, teasing, games
//   tranquil     — Peaceful, calm, serene, gentle
//   connected    — Bonds, togetherness, understanding, partnership
//   reflective   — Introspective, looking back, thoughtful, wondering
// ═══════════════════════════════════════════════════════════════

const MOOD_KEYWORDS = {
  spicy: [
    'sex', 'sexual', 'orgasm', 'climax', 'naked', 'nude', 'strip',
    'moan', 'groan', 'scream', 'gasp', 'panting', 'breathless',
    'lick', 'bite', 'suck', 'thrust', 'grind', 'straddle', 'ride',
    'seduce', 'seduction', 'tease', 'tantalize', 'arouse', 'arousal',
    'erotic', 'erotica', 'naughty', 'dirty', 'filthy', 'kinky',
    'foreplay', 'afterglow', 'climax', 'pleasure',
    'lingerie', 'underwear', 'undress', 'clothing off', 'take off',
    'bed', 'bedroom', 'sheets', 'mattress',
    'body part', 'curves', 'skin', 'lips', 'neck', 'chest', 'thighs',
    'massage', 'oil', 'candle', 'blindfold', 'handcuff', 'rope',
    'dominant', 'submissive', 'power play', 'role play', 'role-play',
    'fantasy about', 'fantasize', 'forbidden', 'taboo',
    'desire', 'lust', 'hunger', 'craving', 'wanting', 'need you',
    'hot', 'steamy', 'scorching', 'burning', 'fire',
    'turn on', 'turns me on', 'turns you on', 'turned on',
    'make love', 'making love', 'in bed', 'between the sheets',
    'tongue', 'fingers', 'hands on', 'touch me', 'feel me',
    'position', 'favorite position', 'try a new',
    'quickie', 'slow and', 'rough', 'gentle but',
    'come', 'cum', 'finish', 'edge', 'edging',
    'wet', 'hard', 'throb', 'pulse', 'ache', 'aching',
  ],
  romantic: [
    'love', 'loving', 'in love', 'fall for', 'fell for',
    'heart', 'heartbeat', 'heartfelt', 'butterflies',
    'soulmate', 'meant to be', 'destiny',
    'date night', 'candlelight', 'candlelit', 'rose', 'roses', 'petal',
    'forever', 'always', 'promise', 'commit', 'devotion',
    'wedding', 'marry', 'marriage', 'vow', 'ring',
    'couple', 'partner', 'together forever',
    'romantic', 'romance', 'romancing',
    'sunset', 'sunrise', 'starlight', 'moonlit', 'moonlight',
    'serenade', 'love letter', 'love note', 'love song',
    'anniversary', 'valentine', 'first kiss',
    'sweep me off', 'swept off', 'fairy tale', 'prince', 'princess',
    'dance with', 'slow dance', 'waltz',
    'gazing', 'gaze into', 'eyes',
    'embrace', 'hold me', 'hold you', 'holding',
    'tender', 'tenderness', 'gentle', 'gently',
    'sweet', 'sweetest', 'sweetheart', 'darling', 'dear',
    'cherish', 'adore', 'treasure',
    'whisper', 'softly', 'murmur',
    'kiss', 'kissing', 'kisses',
  ],
  heartfelt: [
    'grateful', 'gratitude', 'thankful', 'appreciate', 'appreciation',
    'proud', 'pride', 'admire', 'admiration',
    'inspire', 'inspired', 'inspiration',
    'care', 'caring', 'compassion', 'compassionate',
    'empathy', 'understand', 'understanding',
    'support', 'supporting', 'supportive', 'lean on',
    'encourage', 'encouragement', 'uplift', 'uplifting',
    'kind', 'kindest', 'kindness',
    'heal', 'healing', 'comfort', 'comforting',
    'forgive', 'forgiveness', 'forgave',
    'cry', 'cried', 'tears', 'emotional', 'emotions',
    'feel safe', 'feeling safe', 'safe with',
    'vulnerable', 'vulnerability', 'open up',
    'trust', 'trusting', 'trusted',
    'honest', 'honesty', 'truthful',
    'sincere', 'sincerely', 'genuine', 'authentically',
    'touch my heart', 'warm my heart', 'moved me',
    'meaningful', 'means the world', 'means everything',
    'been there for', 'showed up', 'supported me',
    'strength', 'brave', 'courage', 'courageous',
    'overcome', 'persevere', 'resilience',
    'sacrifice', 'selfless', 'unconditional',
  ],
  adventurous: [
    'adventure', 'adventurous', 'explore', 'exploring', 'exploration',
    'try', 'trying', 'experiment', 'experimenting', 'new thing',
    'dare', 'daring', 'bold', 'boldest', 'bravest',
    'risk', 'risky', 'spontaneous', 'impulsive',
    'thrill', 'thrilling', 'exciting', 'excitement', 'exhilarating',
    'wild', 'wildest', 'crazy', 'craziest',
    'unexpected', 'surprise', 'surprising', 'spontaneously',
    'bucket list', 'dream trip', 'road trip',
    'travel', 'traveling', 'journey', 'destination',
    'outside', 'outdoors', 'nature', 'hiking', 'camping',
    'public', 'somewhere new', 'exotic',
    'forbidden', 'taboo', 'boundary', 'push',
    'challenge', 'challenging', 'push yourself', 'out of comfort',
    'skinny dip', 'streak', 'public place',
    'never done', 'first time', 'haven\'t tried',
    'what if we', 'let\'s try', 'would you ever',
    'fantasy', 'fantasize', 'imagine if',
    'role play', 'costume', 'character', 'scenario',
    'escape', 'sneak', 'sneaking', 'secret',
  ],
  cozy: [
    'cozy', 'coziest', 'cozy up', 'snuggle', 'snuggling',
    'cuddle', 'cuddling', 'spooning', 'warm', 'warmth',
    'blanket', 'pillow', 'pajama', 'bathrobe', 'slippers',
    'home', 'at home', 'living room', 'couch', 'sofa', 'fireplace',
    'lazy', 'relaxing', 'relax', 'chill', 'unwind',
    'tea', 'hot chocolate', 'cocoa', 'coffee', 'morning coffee',
    'rainy', 'rain', 'snow', 'winter night', 'cold night',
    'bed', 'bedroom', 'pillow talk', 'in bed together',
    'comfort', 'comfortable', 'comforting',
    'safe', 'safety', 'secure', 'security',
    'routine', 'ritual', 'habit', 'everyday',
    'morning', 'goodnight', 'good night', 'before bed', 'wake up',
    'quiet', 'silence', 'still', 'peaceful',
    'nest', 'nesting', 'homey', 'domestic',
    'familiar', 'predictable', 'steady',
    'bath', 'bubble bath', 'shower together',
    'movie night', 'netflix', 'binge', 'popcorn',
    'sunday', 'weekend', 'day off', 'staycation',
    'soft', 'gentle', 'slow', 'easy',
  ],
  playful: [
    'fun', 'funny', 'funniest', 'hilarious',
    'laugh', 'laughing', 'laughter', 'giggle', 'giggling',
    'joke', 'joking', 'prank', 'pranking',
    'silly', 'goofy', 'dorky', 'weird',
    'game', 'play', 'playing', 'player',
    'compete', 'competition', 'competitive', 'race', 'bet',
    'dare', 'truth or dare', 'would you rather',
    'tease', 'teasing', 'flirt', 'flirting', 'flirty',
    'wink', 'smirk', 'cheeky', 'mischievous',
    'tickle', 'tickling', 'poke', 'nudge',
    'dance', 'dancing', 'sing', 'singing', 'karaoke',
    'costume', 'dress up', 'pretend',
    'emoji', 'gif', 'meme', 'sticker',
    'selfie', 'photo booth', 'silly face',
    'ice cream', 'candy', 'treat', 'dessert',
    'party', 'celebration', 'celebrate',
    'quiz', 'trivia', 'guess', 'riddle',
    'nickname', 'pet name', 'inside joke',
    'food fight', 'pillow fight', 'water fight',
    'puns', 'wordplay',
  ],
  tranquil: [
    'peace', 'peaceful', 'peacefully',
    'calm', 'calming', 'calmness',
    'serene', 'serenity', 'tranquil', 'tranquility',
    'still', 'stillness', 'quiet', 'quietly',
    'breathe', 'breathing', 'breath',
    'meditation', 'meditate', 'mindful', 'mindfulness',
    'zen', 'centered', 'grounded', 'present',
    'nature', 'ocean', 'waves', 'forest', 'garden', 'flowers',
    'sunset', 'sunrise', 'stars', 'sky', 'clouds', 'moon',
    'gentle', 'gently', 'tender', 'tenderly',
    'soft', 'softly', 'whisper', 'murmur',
    'flowing', 'floating', 'drifting',
    'rest', 'resting', 'restful',
    'soothing', 'soothe', 'comfort',
    'silence', 'silent', 'hush',
    'slow', 'slowly', 'unhurried',
    'sanctuary', 'haven', 'retreat',
    'bath', 'candlelight', 'ambient',
    'harmony', 'balance', 'equilibrium',
    'contentment', 'content', 'satisfied',
  ],
  connected: [
    'connect', 'connection', 'connecting', 'connected',
    'bond', 'bonding', 'bonded',
    'together', 'togetherness', 'us', 'we',
    'partner', 'partnership', 'team', 'teammate',
    'share', 'sharing', 'shared',
    'communicate', 'communication', 'talk', 'conversation',
    'listen', 'listening', 'hear', 'hearing',
    'understand', 'understanding', 'understood',
    'sync', 'synced', 'on the same page', 'aligned',
    'know', 'knowing', 'knew', 'knowledge',
    'close', 'closer', 'closeness', 'proximity',
    'intimate', 'intimacy',
    'relationship', 'our relationship',
    'love language', 'attachment',
    'routine', 'ritual', 'tradition',
    'check in', 'check-in', 'how are you',
    'support', 'supporting', 'lean on',
    'rely', 'depend', 'count on',
    'parallel', 'mirroring', 'matching',
    'compromise', 'collaborate', 'work together',
    'communicate', 'express', 'open up',
  ],
  reflective: [
    'remember', 'remembering', 'memory', 'memories',
    'look back', 'looking back', 'reflect', 'reflecting', 'reflection',
    'think', 'thinking', 'thought', 'wonder', 'wondering',
    'used to', 'back when', 'years ago', 'when we first',
    'how far', 'how much', 'how long',
    'change', 'changed', 'changing', 'evolve', 'evolved',
    'grow', 'growth', 'grew', 'grown',
    'learn', 'learned', 'lesson', 'taught',
    'realize', 'realized', 'realization', 'epiphany',
    'if you could go back', 'what would you change',
    'regret', 'wish', 'hindsight',
    'journey', 'path', 'road', 'milestone',
    'chapter', 'season', 'phase', 'era',
    'who you were', 'who you\'ve become', 'who we\'ve become',
    'time', 'passing', 'years', 'aging',
    'nostalgic', 'nostalgia', 'wistful',
    'contemplat', 'ponder', 'muse', 'musing',
    'what if', 'what might', 'could have been',
    'first time', 'when did you first',
    'childhood', 'growing up', 'younger',
    'older', 'wiser', 'mature',
    'perspective', 'point of view', 'shift',
  ],
};

function getMood(prompt) {
  const text = prompt.text.toLowerCase();
  const heat = prompt.heat;

  const scores = {};
  for (const mood of Object.keys(MOOD_KEYWORDS)) {
    scores[mood] = 0;
  }

  // Keyword scoring
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        scores[mood] += 1;
      }
    }
  }

  // ── Heat-only boosts ─────────────────────────────────────────
  // Heat 1 (Comfort): heartfelt / cozy / reflective / connected / tranquil
  // Heat 2 (Spark): romantic / playful / connected
  // Heat 3 (Intimate): romantic / spicy / heartfelt
  // Heat 4 (Adventurous): spicy / adventurous / playful
  // Heat 5 (Passion): spicy
  if (heat === 1) {
    scores.heartfelt += 3;
    scores.cozy += 2;
    scores.reflective += 2;
    scores.connected += 2;
    scores.tranquil += 2;
    // Heat 1 should NEVER be spicy
    scores.spicy -= 10;
  } else if (heat === 2) {
    scores.romantic += 4;
    scores.playful += 2;
    scores.connected += 1;
    // Heat 2 should very rarely be spicy
    scores.spicy -= 5;
  } else if (heat === 3) {
    scores.romantic += 2;
    scores.spicy += 2;
    scores.heartfelt += 1;
  } else if (heat === 4) {
    scores.spicy += 3;
    scores.adventurous += 2;
    scores.playful += 1;
  } else if (heat === 5) {
    scores.spicy += 5;
  }

  // ── Text pattern boosts ──────────────────────────────────────
  if (/what does .* mean to you/i.test(text)) scores.reflective += 2;
  if (/how (do|did|would|does) .* (feel|make you feel)/i.test(text)) scores.heartfelt += 2;
  if (/if (we|you) could/i.test(text)) scores.adventurous += 1;
  if (/close your eyes/i.test(text)) scores.tranquil += 2;
  if (/imagine/i.test(text)) scores.adventurous += 1;
  if (/which .* do you/i.test(text)) scores.playful += 1;
  if (/where would you/i.test(text)) scores.adventurous += 1;
  if (/describe .* in detail/i.test(text)) {
    if (heat >= 3) scores.spicy += 2;
    else scores.heartfelt += 1;
  }

  // Find the highest scoring mood
  let bestMood = 'connected'; // sensible fallback
  let bestScore = -1;
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  return bestMood;
}

// ═══════════════════════════════════════════════════════════════
// PROCESS ALL PROMPTS
// ═══════════════════════════════════════════════════════════════

let updated = 0;
for (const prompt of data.items) {
  prompt.depth = getDepth(prompt);
  prompt.mood = getMood(prompt);
  updated++;
}

// ── Update meta ──────────────────────────────────────────────
data.meta.depth = {
  light: "Fun and lighthearted",
  meaningful: "Thoughtful connection",
  deep: "Vulnerable and intimate"
};
data.meta.moods = {
  spicy: "Sexually suggestive, hot, provocative",
  romantic: "Love, romance, sweetness, tenderness",
  heartfelt: "Emotional, sincere, touching, caring",
  adventurous: "Bold, exciting, trying new things",
  cozy: "Comfortable, warm, safe, home",
  playful: "Fun, lighthearted, teasing, games",
  tranquil: "Peaceful, calm, serene, gentle",
  connected: "Bonds, togetherness, understanding",
  reflective: "Introspective, looking back, thoughtful"
};

// ── Write out ──────────────────────────────────────────────
fs.writeFileSync(PROMPTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

// ── Print distribution stats ───────────────────────────────
const depthDist = {};
const moodDist = {};
const depthByHeat = {};
const moodByHeat = {};

data.items.forEach(p => {
  depthDist[p.depth] = (depthDist[p.depth] || 0) + 1;
  moodDist[p.mood] = (moodDist[p.mood] || 0) + 1;

  const hk = `heat_${p.heat}`;
  if (!depthByHeat[hk]) depthByHeat[hk] = {};
  depthByHeat[hk][p.depth] = (depthByHeat[hk][p.depth] || 0) + 1;

  if (!moodByHeat[hk]) moodByHeat[hk] = {};
  moodByHeat[hk][p.mood] = (moodByHeat[hk][p.mood] || 0) + 1;
});

console.log(`\n✅ Updated ${updated} prompts with depth & mood\n`);
console.log('Depth distribution:', JSON.stringify(depthDist, null, 2));
console.log('\nMood distribution:', JSON.stringify(moodDist, null, 2));
console.log('\nDepth by heat level:', JSON.stringify(depthByHeat, null, 2));
console.log('\nMood by heat level:', JSON.stringify(moodByHeat, null, 2));

// Validate: show 3 random samples per mood
console.log('\n── Sample prompts per mood ──');
for (const mood of Object.keys(MOOD_KEYWORDS)) {
  const matching = data.items.filter(p => p.mood === mood);
  const samples = matching.sort(() => Math.random() - 0.5).slice(0, 3);
  console.log(`\n${mood.toUpperCase()} (${matching.length}):`);
  samples.forEach(s => console.log(`  [h${s.heat}/${s.depth}] ${s.text.substring(0, 90)}`));
}

// Validate: show 3 random samples per depth
console.log('\n── Sample prompts per depth ──');
for (const depth of ['light', 'meaningful', 'deep']) {
  const matching = data.items.filter(p => p.depth === depth);
  const samples = matching.sort(() => Math.random() - 0.5).slice(0, 3);
  console.log(`\n${depth.toUpperCase()} (${matching.length}):`);
  samples.forEach(s => console.log(`  [h${s.heat}/${s.mood}] ${s.text.substring(0, 90)}`));
}
