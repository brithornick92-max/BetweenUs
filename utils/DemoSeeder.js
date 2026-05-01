import { randomUUID } from 'expo-crypto';
import { supabase, TABLES } from '../config/supabase';
import { storage, STORAGE_KEYS, settingsStorage } from './storage';
import { NicknameEngine, RelationshipSeasons, SoftBoundaries } from '../services/PolishEngine';
import { Image } from 'react-native';

const ME = 'Alex';
const PARTNER = 'Jordan';
const RELATIONSHIP_START_DATE = '2023-02-14';
const DEFAULT_TONE = 'warm';
const DEFAULT_HEAT_LEVEL = 3;
const DEFAULT_SEASON = 'steady_and_close';
const SEEDED_DATA_TYPES = ['journal', 'prompt_answer', 'memory', 'check_in', 'vibe', 'date_plan'];
const DEMO_SEEDING_ENABLED = false;

const DEMO_IMAGE_MODULES = [
  require('../assets/simulator-media/between-us-date-night-1.png'),
  require('../assets/simulator-media/between-us-date-night-2.png'),
  require('../assets/simulator-media/between-us-date-night-3.png'),
  require('../assets/simulator-media/between-us-date-night-4.png'),
  require('../assets/simulator-media/between-us-date-night-5.png'),
  require('../assets/simulator-media/between-us-date-night-6.png'),
  require('../assets/simulator-media/between-us-date-night-7.png'),
  require('../assets/simulator-media/between-us-date-night-8.png'),
  require('../assets/simulator-media/between-us-date-night-9.png'),
  require('../assets/simulator-media/between-us-date-night-10.png'),
];

const DEMO_VIDEO_MODULES = [
  require('../assets/simulator-media/between-us-date-night-video.mp4'),
  require('../assets/simulator-media/between-us-date-night-video-2.mp4'),
  require('../assets/simulator-media/between-us-date-night-video-3.mp4'),
  require('../assets/simulator-media/between-us-date-night-video-4.mp4'),
  require('../assets/simulator-media/between-us-date-night-video-5.mp4'),
];

const JOURNAL_TITLES = [
  'Daily Thought',
  'Little Things I Want To Remember',
  'Us Lately',
  'Today Felt Good',
  'Weekly Reflection',
  'A Small Moment That Mattered',
  'What I Keep Coming Back To',
];

const JOURNAL_OPENERS = [
  `Today felt softer than it has in a while with ${PARTNER}.`,
  `I kept noticing all the little ways ${PARTNER} made today easier.`,
  `Nothing huge happened today, but it still felt worth writing down.`,
  `I could feel how much our pace has changed lately in a good way.`,
  `I felt especially aware today of how connected we are becoming.`,
  `Today reminded me that we do not need a big moment for something to matter.`,
  `I kept thinking about how easy it is to miss the good if I do not pause and name it.`,
];

const JOURNAL_DETAILS = [
  `We were both a little tired, but the way we kept turning back toward each other mattered.`,
  `Even our normal routine felt intimate in that quiet, lived-in way I never want to take for granted.`,
  `There was a small moment in the kitchen that made me feel very chosen.`,
  `I felt calmer after we talked honestly instead of trying to rush past it.`,
  `It meant a lot that we kept making contact throughout the day, even briefly.`,
  `We have both been carrying a lot, and I still felt us protecting something tender between us.`,
  `I could feel how much trust lives in the little things now.`,
  `The night felt simple, but it restored me more than I expected.`,
  `I noticed how much safer I feel when we are playful instead of trying to be perfect.`,
  `Even when the day was ordinary, there was still that feeling of being on the same side.`,
];

const JOURNAL_CLOSERS = [
  `I want to remember this version of us.`,
  `It made me feel hopeful about what we are building.`,
  `I do not want to rush past days like this anymore.`,
  `It felt like the kind of closeness that lasts.`,
  `I left the day feeling steadier than I started it.`,
  `This is the kind of memory that quietly becomes part of the foundation.`,
];

const JOURNAL_TAGS = [
  'connection',
  'gratitude',
  'playfulness',
  'repair',
  'desire',
  'safety',
  'tenderness',
  'daily-life',
  'hope',
  'communication',
  'rituals',
  'trust',
];

const VIBES = ['happy', 'cozy', 'tired', 'playful', 'stressed', 'adventurous', 'romantic', 'focused', 'grateful'];
const MOODS = ['Excellent', 'Good', 'Okay', 'Rough', 'Awful'];
const INTIMACY_LEVELS = [1, 2, 3, 4, 5];

const VIBE_NOTES = [
  `Thinking about ${PARTNER}.`,
  `Still smiling about last night.`,
  `Need a quiet evening together soon.`,
  `Missing you a little extra today.`,
  `Today feels lighter when we stay connected.`,
  `I keep replaying that little moment from earlier.`,
];

const CHECKIN_NOTES = [
  `Just checking in. Everything feels solid right now with ${PARTNER}.`,
  `A little tired, but still feeling close to ${PARTNER}.`,
  `We are busy, but I still feel chosen.`,
  `Need a softer night together and some affection.`,
  `Feeling really grateful for our rhythm this week.`,
  `Could use a reset date soon, but we are okay.`,
  `A little tender today, but I still feel like we are on the same team.`,
  `Not our easiest day, but I still feel connected underneath it.`,
];

const MEMORY_MOODS = ['Happy', 'Cozy', 'Playful', 'Romantic', 'Proud', 'Tender', 'Hopeful'];

const MEMORY_SEEDS = {
  moment: [
    `The way ${PARTNER} reached for my hand in the car without looking over.`,
    `A slow kitchen moment that somehow felt more intimate than a big date night.`,
    `We both looked exhausted, but we still made space to laugh together on the couch.`,
    `Coffee, quiet music, and that feeling that the room softened when we were both in it.`,
    `A normal errand turned into one of those little memories I know I will keep.`,
  ],
  first: [
    `Our first time trying that tiny neighborhood wine bar and immediately knowing we would come back.`,
    `The first time we took the long way home on purpose just to keep the night going.`,
    `The first morning we made a ritual out of coffee and no phones.`,
    `The first time a regular weeknight started to feel like ours in a deeper way.`,
  ],
  anniversary: [
    `We took a minute to remember how much has changed since the beginning, and it made me emotional in the best way.`,
    `Marking us quietly mattered more than doing something big.`,
    `We talked about what we have survived and what feels easier now, and I felt proud of us.`,
  ],
  milestone: [
    `A small win for one of us felt like a win for both of us today.`,
    `We handled something hard with more gentleness than we used to, and that felt like growth.`,
    `Today felt like one of those moments where you realize the relationship is maturing.`,
    `We named something honestly and stayed close through it, which felt significant.`,
  ],
  inside_joke: [
    `We started laughing about the same ridiculous thing again and somehow it was still just as funny.`,
    `That ongoing joke between us keeps making ordinary days feel like they have a secret layer.`,
    `No one else would understand why this was funny, which made it feel even more ours.`,
    `The joke was stupid and perfect and exactly what we both needed.`,
  ],
  thinking_of_you: [
    `Saw this and immediately thought of you. It felt like such a small thing, but so you.`,
    `I saved this because it made me miss you in a sweet way.`,
    `This reminded me of your face when you are trying not to laugh.`,
    `I wanted to leave a little trace of you in the middle of my day.`,
    `Could not explain it exactly, just knew it belonged to us.`,
  ],
};

const PROMPT_PAIRS = [
  {
    id: 'h1_001',
    heat: 1,
    answers: [
      `I instantly notice your smile. It changes the whole room for me.`,
      `I notice how safe I feel around you when you soften your voice.`,
      `I always notice your eyes first when you are happy.`,
    ],
  },
  {
    id: 'h1_004',
    heat: 1,
    answers: [
      `Home used to feel like a place. Now it feels like being with you.`,
      `You make ordinary nights feel like they count.`,
      `I feel most at home in the parts of the day where we are relaxed and fully ourselves.`,
    ],
  },
  {
    id: 'h2_001',
    heat: 2,
    answers: [
      `When you wear that dark green shirt, it is honestly distracting.`,
      `It is hot when you take initiative and make the plan without making it feel controlling.`,
      `I love the look you get when you know exactly what you want from me.`,
    ],
  },
  {
    id: 'h3_010',
    heat: 3,
    answers: [
      `I love the way your hands feel when you pull me close after we wake up.`,
      `The moments right before a kiss with you still feel electric to me.`,
      `I think about how your body relaxes against mine more than I probably say out loud.`,
    ],
  },
  {
    id: 'h4_020',
    heat: 4,
    answers: [
      `That time we could barely make it through the doorway is still very much in my mind.`,
      `I still replay the night we could not stop touching each other between laughing fits.`,
      `I keep thinking about the kind of chemistry that makes time disappear for us.`,
    ],
  },
];

const QUIZ_PAIRS = [
  {
    id: 'quiz_favorite_comfort_food',
    mine: 'Tomato soup and grilled cheese with extra black pepper.',
    partner: 'Thai curry and sparkling water while we watch something cozy.',
  },
  {
    id: 'quiz_best_weekend_start',
    mine: 'Coffee first, playlist second, then a long walk before brunch.',
    partner: 'Sleeping in, pancakes, and no calendar for a few hours.',
  },
  {
    id: 'quiz_stress_signal',
    mine: 'They get extra quiet and start organizing tiny things.',
    partner: 'They ask for a hug before they can explain what happened.',
  },
  {
    id: 'quiz_ideal_date_energy',
    mine: 'A low-pressure dinner out followed by a drive and dessert.',
    partner: 'A night in with candles, takeout, and phones face down.',
  },
  {
    id: 'quiz_smallest_love_language',
    mine: 'When they plug my phone in before bed because they know I forgot.',
    partner: 'When they save the last bite for me without saying anything.',
  },
];

const CALENDAR_EVENTS = [
  { title: `Dinner Date at ${ME}'s favorite spot`, type: 'dateNight' },
  { title: `Movie Night In - ${PARTNER}'s turn to pick`, type: 'dateNight' },
  { title: 'Hiking trip upstate', type: 'general' },
  { title: 'Coffee date before work', type: 'dateNight' },
  { title: 'Sunday brunch with friends', type: 'general' },
  { title: 'Bookstore browse and wine bar stop', type: 'dateNight' },
  { title: 'Midweek reset walk by the water', type: 'general' },
  { title: 'Cook something new together night', type: 'dateNight' },
  { title: 'Farmers market and flower run', type: 'general' },
];

const CALENDAR_LOCATIONS = ['Downtown', 'Riverside', 'At home', 'West Village', 'Neighborhood favorite', 'Uptown'];

const DATE_PLAN_VARIANTS = [
  {
    locationType: 'out',
    heat: 2,
    load: 2,
    style: 'cozy',
    steps: ['Leave work on time.', 'Share one appetizer and one dessert.', 'End the night with a walk and no phones.'],
  },
  {
    locationType: 'home',
    heat: 2,
    load: 1,
    style: 'low-key',
    steps: ['Order the good takeout.', 'Light the candles.', 'Watch one thing together, then talk on the couch.'],
  },
  {
    locationType: 'out',
    heat: 3,
    load: 3,
    style: 'playful',
    steps: ['Pick an outfit that feels fun.', 'Try somewhere new.', 'Take one photo together before heading home.'],
  },
  {
    locationType: 'mixed',
    heat: 2,
    load: 2,
    style: 'adventurous',
    steps: ['Start with coffee.', 'Do one small spontaneous stop.', 'Debrief the best part before bed.'],
  },
];

let _demoAssets = null;

function resolveDemoAssets() {
  if (_demoAssets) return _demoAssets;

  try {
    const images = DEMO_IMAGE_MODULES.map((mod, idx) => {
      const src = Image.resolveAssetSource(mod);
      return src?.uri ? { uri: src.uri, name: `date-night-${idx + 1}.png`, mimeType: 'image/png' } : null;
    }).filter(Boolean);

    const videos = DEMO_VIDEO_MODULES.map((mod, idx) => {
      const src = Image.resolveAssetSource(mod);
      return src?.uri ? { uri: src.uri, name: `date-night-video-${idx + 1}.mp4`, mimeType: 'video/mp4' } : null;
    }).filter(Boolean);

    _demoAssets = { images, videos };
  } catch {
    _demoAssets = { images: [], videos: [] };
  }

  return _demoAssets;
}

function pick(items, index, offset = 0) {
  return items[(index + offset) % items.length];
}

function boolEvery(index, every, offset = 0) {
  return (index + offset) % every === 0;
}

function tsDaysAgo(daysAgo, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function isoDaysAgo(daysAgo, hour, minute = 0) {
  return tsDaysAgo(daysAgo, hour, minute).toISOString();
}

function dateKeyFromIso(iso) {
  return iso.split('T')[0];
}

function buildJournalBody(dayIndex, voiceShift = 0) {
  return [
    pick(JOURNAL_OPENERS, dayIndex, voiceShift),
    pick(JOURNAL_DETAILS, dayIndex, voiceShift + 2),
    pick(JOURNAL_DETAILS, dayIndex, voiceShift + 5),
    pick(JOURNAL_CLOSERS, dayIndex, voiceShift + 1),
  ].join(' ');
}

function buildJournalTags(dayIndex) {
  return [
    pick(JOURNAL_TAGS, dayIndex, 0),
    pick(JOURNAL_TAGS, dayIndex, 3),
    pick(JOURNAL_TAGS, dayIndex, 6),
  ];
}

function buildMemoryBody(type, dayIndex, voiceShift = 0) {
  return pick(MEMORY_SEEDS[type] || MEMORY_SEEDS.moment, dayIndex, voiceShift);
}

function buildMemoryMood(dayIndex, voiceShift = 0) {
  return pick(MEMORY_MOODS, dayIndex, voiceShift);
}

function pickDemoAsset({ preferVideo = false, assetIndex = 0 } = {}) {
  try {
    const assets = resolveDemoAssets();
    const useVideo = preferVideo && assets.videos.length > 0;
    const pool = useVideo ? assets.videos : assets.images;
    const asset = pool[assetIndex % pool.length];
    if (!asset?.uri) {
      console.warn('Seeder: No asset URI found for', { assetIndex, poolSize: pool.length });
      return null;
    }
    return asset;
  } catch (err) {
    console.warn('Seeder: Media asset resolution failed:', err?.message);
    return null;
  }
}

function makeId(prefix = 'row') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function insertCoupleDataRow({ dataType, coupleId, createdBy, value, createdAt, updatedAt = createdAt, isPrivate = false }) {
  const rowId = value?.id || makeId(dataType);
  const { error } = await supabase.from(TABLES.COUPLE_DATA).insert({
    couple_id: coupleId,
    key: `${dataType}_${rowId}`,
    value: {
      ...value,
      id: rowId,
      user_id: createdBy,
      couple_id: coupleId,
      created_at: createdAt,
      updated_at: updatedAt,
    },
    data_type: dataType,
    created_by: createdBy,
    is_private: isPrivate,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  if (error) {
    console.warn(`Seeder: Failed to insert ${dataType}:`, error.message);
    throw error;
  }

  return rowId;
}

async function insertPromptAnswerRow({ userId, coupleId, promptId, answer, partnerAnswer = null, heat, dateKey, createdAt }) {
  return insertCoupleDataRow({
    dataType: 'prompt_answer',
    coupleId,
    createdBy: userId,
    createdAt,
    value: {
      id: makeId('ans'),
      promptId,
      dateKey,
      answer,
      partnerAnswer,
      heatLevel: heat,
      isRevealed: !!partnerAnswer,
      revealAt: partnerAnswer ? createdAt : null,
    },
  });
}

async function insertDatePlanRow({ userId, coupleId, sourceEventId, title, variant, createdAt, dayIndex = 0, isCompleted = false }) {
  const completedAt = isCompleted ? createdAt : null;
  const planBody = {
    locationType: variant.locationType,
    heat: variant.heat,
    load: variant.load,
    style: variant.style,
    steps: variant.steps,
    status: isCompleted ? 'completed' : 'planned',
    completedAt,
    reflection: isCompleted
      ? pick([
          'We actually followed through on this one and it felt grounding.',
          'This date left us feeling more connected than either of us expected.',
          'Small plan, big payoff. It ended up being one of our favorite nights lately.',
          'We kept this simple and still made it memorable.',
        ], dayIndex)
      : pick([
          'Looking forward to this one already.',
          'This feels like exactly the kind of plan we need this week.',
          'Built to be easy to say yes to even on a busy day.',
          'Saving this as something warm to look forward to together.',
        ], dayIndex, 1),
  };

  return insertCoupleDataRow({
    dataType: 'date_plan',
    coupleId,
    createdBy: userId,
    createdAt,
    value: {
      id: makeId('dp'),
      title,
      sourceEventId,
      ...planBody,
    },
  });
}

async function clearReviewerData(myUserId, coupleId) {
  console.log('Seeder: Clearing data from Supabase...');

  try {
    const { error: coupleDataError } = await supabase
      .from(TABLES.COUPLE_DATA)
      .delete()
      .eq('couple_id', coupleId)
      .eq('created_by', myUserId)
      .in('data_type', SEEDED_DATA_TYPES);

    if (coupleDataError && !coupleDataError.message?.includes('no rows')) {
      console.warn(`Seeder: Failed to clear ${TABLES.COUPLE_DATA}:`, coupleDataError.message);
    }

    const { error: calendarError } = await supabase
      .from(TABLES.CALENDAR_EVENTS)
      .delete()
      .eq('couple_id', coupleId)
      .eq('created_by', myUserId);

    if (calendarError && !calendarError.message?.includes('no rows')) {
      console.warn(`Seeder: Failed to clear ${TABLES.CALENDAR_EVENTS}:`, calendarError.message);
    }

    console.log('Seeder: Data cleared successfully');
  } catch (err) {
    console.warn('Seeder: Clear failed:', err?.message);
  }
}

async function seedCurrentState({ myUserId, partnerId, coupleId }) {
  const userProfile = {
    displayName: ME,
    firstName: ME,
    relationshipStartDate: RELATIONSHIP_START_DATE,
    onboardingCompleted: true,
    partnerNames: {
      myName: ME,
      partnerName: PARTNER,
    },
    partnerNickname: PARTNER,
    tone: DEFAULT_TONE,
    heatLevelPreference: DEFAULT_HEAT_LEVEL,
    season: {
      id: DEFAULT_SEASON,
      setAt: Date.now(),
    },
    softBoundaries: {
      hideSpicy: false,
      pausedDates: [],
      pausedEntries: [],
      hiddenCategories: [],
      maxHeatOverride: null,
    },
    quiz: {
      favoriteDateType: 'cozy night in',
      communicationStyle: 'gentle honesty',
      affectionStyle: 'frequent small touch',
    },
  };

  const partnerProfile = {
    id: partnerId,
    displayName: PARTNER,
    firstName: PARTNER,
    partnerNames: {
      myName: PARTNER,
      partnerName: ME,
    },
  };

  await storage.set(STORAGE_KEYS.USER_PROFILE, userProfile);
  await storage.set(STORAGE_KEYS.PARTNER_PROFILE, partnerProfile);
  await storage.set(STORAGE_KEYS.PARTNER_LABEL, PARTNER);
  await storage.set(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
  await storage.set(STORAGE_KEYS.PENDING_ONBOARDING, false);
  await storage.set(STORAGE_KEYS.COUPLE_ID, coupleId);
  await storage.set(STORAGE_KEYS.USER_ID, myUserId);
  await storage.set(STORAGE_KEYS.PREMIUM_STATUS, true);
  await storage.set(STORAGE_KEYS.PARTNER_PREMIUM_STATUS, true);
  await storage.set(STORAGE_KEYS.LAST_PARTNER_ACTIVITY, Date.now());

  if (settingsStorage?.setThemeMode) await settingsStorage.setThemeMode('dark');
  if (settingsStorage?.setAppLockEnabled) await settingsStorage.setAppLockEnabled(false);
  if (settingsStorage?.setPrivacySettings) {
    await settingsStorage.setPrivacySettings({ hideOnRecents: true, requireAuthForSensitiveScreens: false });
  }
  if (settingsStorage?.setNotificationSettings) {
    await settingsStorage.setNotificationSettings({ prompts: true, dateNights: true, memories: true, partnerActivity: true });
  }
  if (settingsStorage?.setDateNightDefaults) {
    await settingsStorage.setDateNightDefaults({ style: 'mixed', load: 2, heat: DEFAULT_HEAT_LEVEL, locationType: 'mixed' });
  }

  if (NicknameEngine?.setConfig) await NicknameEngine.setConfig({ myNickname: ME, partnerNickname: PARTNER, tone: DEFAULT_TONE });
  if (RelationshipSeasons?.set) await RelationshipSeasons.set(DEFAULT_SEASON);
  if (SoftBoundaries?.setAll) {
    await SoftBoundaries.setAll({ hideSpicy: false, pausedDates: [], pausedEntries: [], hiddenCategories: [], maxHeatOverride: null });
  }
}

function chooseMemoryType(dayIndex) {
  if (boolEvery(dayIndex, 11, 2)) return 'anniversary';
  if (boolEvery(dayIndex, 8, 1)) return 'milestone';
  if (boolEvery(dayIndex, 7, 3)) return 'inside_joke';
  if (boolEvery(dayIndex, 6, 0)) return 'thinking_of_you';
  if (boolEvery(dayIndex, 10, 5)) return 'first';
  return 'moment';
}

export async function seedReviewerData() {
  try {
    if (!DEMO_SEEDING_ENABLED) {
      console.warn('Seeder: Demo seeding is disabled.');
      return { success: false, error: 'Demo seeding is disabled' };
    }

    const user = await supabase.auth.getUser();
    if (!user?.data?.user?.email?.toLowerCase().includes('betweenusreviewer')) {
      console.warn('Seeder: This script is restricted to reviewer accounts only.');
      return { success: false, error: 'Restricted to reviewer accounts only' };
    }

    const myUserId = user.data.user.id;
    console.log('Seeder: Starting for user', myUserId);

    const { data: myMembership, error: membershipError } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('couple_id, user_id')
      .eq('user_id', myUserId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!myMembership?.couple_id) {
      const message = 'Reviewer account must be linked to a couple before seeding Supabase demo data.';
      console.warn('Seeder:', message);
      return { success: false, error: message };
    }

    const { data: memberships, error: membersError } = await supabase
      .from(TABLES.COUPLE_MEMBERS)
      .select('couple_id, user_id')
      .eq('couple_id', myMembership.couple_id);

    if (membersError) throw membersError;

    const coupleId = myMembership.couple_id;
    const partnerId = memberships?.find((m) => m.user_id !== myUserId)?.user_id || '99999999-9999-4999-9999-999999999999';

    console.log('Seeder: Couple ID:', coupleId);
    console.log('Seeder: Partner ID:', partnerId);
    console.log('Seeder: Using plaintext Supabase tables:', `${TABLES.COUPLE_DATA}, ${TABLES.CALENDAR_EVENTS}`);

    console.log('Seeder: Clearing existing data...');
    await clearReviewerData(myUserId, coupleId);

    console.log('Seeder: Setting up current state...');
    await seedCurrentState({ myUserId, partnerId, coupleId });

    const stats = {
      vibes: 0,
      checkIns: 0,
      journals: 0,
      prompts: 0,
      quizzes: 0,
      memories: 0,
      rituals: 0,
      calendar: 0,
      datePlans: 0,
      media: 0,
    };

    let promptIndex = 0;
    let quizIndex = 0;
    let canSeedMemories = true;
    let canSeedCalendar = true;
    let canSeedDatePlans = true;

    for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
      const dayIndex = 89 - daysAgo;
      const rowIsPartner = dayIndex % 2 === 1;
      const demoAuthorName = rowIsPartner ? PARTNER : ME;
      const demoAuthorId = rowIsPartner ? partnerId : myUserId;

      const baseIso = isoDaysAgo(daysAgo, 8 + (dayIndex % 4), (dayIndex * 7) % 60);
      const dateKey = dateKeyFromIso(baseIso);

      try {
        {
          const vibe = pick(VIBES, dayIndex, rowIsPartner ? 2 : 0);
          const vibeNote = boolEvery(dayIndex, 2, rowIsPartner ? 1 : 0)
            ? pick(VIBE_NOTES, dayIndex, rowIsPartner ? 2 : 0)
            : '';

          await insertCoupleDataRow({
            dataType: 'vibe',
            coupleId,
            createdBy: myUserId,
            createdAt: baseIso,
            value: {
              id: makeId('vib'),
              vibe,
              note: vibeNote || null,
              demoAuthorId,
              demoAuthorName,
            },
          });
          stats.vibes += 1;
        }

        {
          const mood = pick(MOODS, dayIndex, rowIsPartner ? 2 : 0);
          await insertCoupleDataRow({
            dataType: 'check_in',
            coupleId,
            createdBy: myUserId,
            createdAt: baseIso,
            value: {
              id: makeId('chk'),
              mood,
              intimacy: pick(INTIMACY_LEVELS, dayIndex, rowIsPartner ? 1 : 0),
              notes: pick(CHECKIN_NOTES, dayIndex, rowIsPartner ? 2 : 0),
              touch: !boolEvery(dayIndex, 5, 2),
              dateKey,
              demoAuthorId,
              demoAuthorName,
            },
          });
          stats.checkIns += 1;
        }

        {
          const journalId = makeId('jrn');
          const journalMood = pick(MOODS, dayIndex, rowIsPartner ? 1 : 0);
          const tags = buildJournalTags(dayIndex + (rowIsPartner ? 1 : 0));
          const journalTitle = pick(JOURNAL_TITLES, dayIndex, rowIsPartner ? 2 : 0);
          const journalBody = buildJournalBody(dayIndex, rowIsPartner ? 3 : 0);
          const includeMedia = boolEvery(dayIndex, 6, 1);
          const asset = includeMedia ? pickDemoAsset({ assetIndex: dayIndex }) : null;
          const journalIso = isoDaysAgo(daysAgo, 21, (dayIndex * 11) % 60);

          await insertCoupleDataRow({
            dataType: 'journal',
            coupleId,
            createdBy: myUserId,
            createdAt: journalIso,
            value: {
              id: journalId,
              title: journalTitle,
              body: journalBody,
              mood: journalMood,
              tags,
              photoUri: asset?.mimeType?.startsWith('image/') ? asset.uri : null,
              mediaPath: null,
              mediaBucket: null,
              mimeType: asset?.mimeType || null,
              demoAuthorId,
              demoAuthorName,
            },
            isPrivate: false,
          });
          if (asset) stats.media += 1;
          stats.journals += 1;
        }

        {
          const prompt = pick(PROMPT_PAIRS, promptIndex, 0);
          const myAnswer = pick(prompt.answers, dayIndex, rowIsPartner ? 1 : 0);
          const partnerReply = pick(prompt.answers, dayIndex, rowIsPartner ? 0 : 1);
          await insertPromptAnswerRow({
            userId: myUserId,
            coupleId,
            promptId: prompt.id,
            answer: myAnswer,
            partnerAnswer: partnerReply,
            heat: prompt.heat,
            dateKey,
            createdAt: isoDaysAgo(daysAgo, 20, (dayIndex * 9) % 60),
          });
          stats.prompts += 2;
          promptIndex += 1;
        }

        if (canSeedMemories) {
          const memoryType = chooseMemoryType(dayIndex);
          const body = buildMemoryBody(memoryType, dayIndex, rowIsPartner ? 2 : 0);
          const mood = buildMemoryMood(dayIndex, rowIsPartner ? 3 : 0);
          const memoryIso = isoDaysAgo(daysAgo, 18, (dayIndex * 5) % 60);

          try {
            await insertCoupleDataRow({
              dataType: 'memory',
              coupleId,
              createdBy: myUserId,
              createdAt: memoryIso,
              value: {
                id: makeId('mem'),
                type: memoryType,
                content: body,
                mood,
                mediaPath: null,
                mediaBucket: null,
                mimeType: null,
                demoAuthorId,
                demoAuthorName,
              },
              isPrivate: false,
            });
            stats.memories += 1;
          } catch (err) {
            canSeedMemories = false;
            console.warn('Seeder: Skipping remaining memories:', err?.message);
          }
        }

        if (canSeedCalendar) {
          const event = {
            ...pick(CALENDAR_EVENTS, dayIndex, rowIsPartner ? 1 : 0),
            type: 'dateNight',
          };
          const eventWhen = tsDaysAgo(daysAgo, 19, (dayIndex * 3) % 60);
          const eventIso = eventWhen.toISOString();
          const eventTitle = event.title;
          const eventLocation = pick(CALENDAR_LOCATIONS, dayIndex, rowIsPartner ? 3 : 0);
          const eventNotes = event.type === 'dateNight'
            ? 'Planned together after talking about what would help us reconnect this week.'
            : 'A shared plan that reflects how often we keep choosing little rhythms together.';
          const variant = pick(DATE_PLAN_VARIANTS, dayIndex, rowIsPartner ? 1 : 0);
          const calendarId = randomUUID();

          const { error: calendarError } = await supabase.from(TABLES.CALENDAR_EVENTS).insert({
            id: calendarId,
            couple_id: coupleId,
            title: eventTitle,
            description: eventNotes,
            event_date: eventIso,
            event_type: event.type,
            location: eventLocation,
            heat_level: variant.heat,
            is_completed: daysAgo > 0,
            metadata: {
              isDateNight: event.type === 'dateNight',
              notify: false,
              notifyMins: 60,
              notificationId: null,
              demoAuthorId,
              demoAuthorName,
            },
            created_by: myUserId,
            created_at: eventIso,
            updated_at: eventIso,
          });

          if (calendarError) {
            canSeedCalendar = false;
            console.warn('Seeder: Skipping remaining calendar events:', calendarError.message);
          } else {
            stats.calendar += 1;

            if (canSeedDatePlans) {
              try {
                await insertDatePlanRow({
                  userId: myUserId,
                  coupleId,
                  sourceEventId: calendarId,
                  title: eventTitle,
                  variant,
                  createdAt: eventIso,
                  dayIndex,
                  isCompleted: daysAgo > 0,
                });
                stats.datePlans += 1;
              } catch (err) {
                canSeedDatePlans = false;
                console.warn('Seeder: Skipping remaining date plans:', err?.message);
              }
            }
          }
        }

        if (boolEvery(dayIndex, 6, 2)) {
          const quiz = pick(QUIZ_PAIRS, quizIndex, 0);
          await insertPromptAnswerRow({
            userId: myUserId,
            coupleId,
            promptId: quiz.id,
            answer: quiz.mine,
            partnerAnswer: quiz.partner,
            heat: 1,
            dateKey,
            createdAt: isoDaysAgo(daysAgo, 20, (dayIndex * 9) % 60),
          });

          stats.quizzes += 2;
          quizIndex += 1;
        }
      } catch (err) {
        console.warn('Seeder err at day', daysAgo, err?.message);
      }
    }

    console.log(`Seeder Complete: ${JSON.stringify(stats)}`);
    console.log('Seeder: Data written directly to Supabase couple_data/calendar_events. Refresh the app to see changes.');
    return { success: true, ...stats };
  } catch (err) {
    console.error('Seeder: Fatal error:', err);
    return { success: false, error: err?.message || 'Unknown error occurred' };
  }
}
