import DataLayer from '../services/data/DataLayer';
import { supabase } from '../config/supabase';
import SyncEngine from '../services/sync/SyncEngine';

// Hardcoded names for the demo content
const N1 = 'Alex';
const N2 = 'Jordan';

const JOURNAL_SNIPPETS = [
  `Today was incredible. We finally took that walk down by the river like we planned and ${N2} just looked amazing in the golden hour light.`,
  `Feeling a bit stressed about work, but having ${N1} to come home to makes everything better.`,
  `Can't stop thinking about our weekend trip. The cabin was perfectly cozy, and ${N2} made the best coffee every morning.`,
  `Just a quiet evening at home. Ordered pizza, watched a terrible movie, loved every second with ${N1}.`,
  `I am so grateful for how supportive ${N2} has been lately. `,
  `Had a small argument earlier with ${N1}. It was silly, but resolving it together means the world to me.`,
  `Wow, that new restaurant ${N2} found is definitely our new favorite spot.`,
  `Woke up feeling incredibly energized today. The coffee helped, but mostly it's waking up next to ${N1}.`,
  `Looking forward to the holidays. ${N2} and I need to start planning what we're going to bring.`,
  `${N1} looked so beautiful this morning making breakfast. Just had to write it down so I never forget this feeling.`,
  `Such a long week. So glad ${N2} surprised me with my favorite takeout.`,
  `I realized today how much I've grown since meeting ${N1}. I'm much more patient now.`,
  `We finally booked those concert tickets! ${N2} was so excited.`
];

const MEMORIES = [
  { content: `${N1} trying to cook dinner and completely burning the pasta 😂`, mood: 'Playful', type: 'funny' },
  { content: `Our lazy Sunday watching movies in the rain.`, mood: 'Cozy', type: 'moment' },
  { content: `When ${N2} surprised me at the airport with flowers.`, mood: 'Romantic', type: 'milestone' },
  { content: `That hike where we got completely lost but found that hidden waterfall.`, mood: 'Adventurous', type: 'moment' },
  { content: `Celebrating ${N1}'s big promotion at work!`, mood: 'Proud', type: 'milestone' },
  { content: `Singing terribly in the car together all the way down the coast.`, mood: 'Happy', type: 'funny' },
];

const PROMPT_PAIRS = [
  { id: 'h1_001', heat: 1, answer: `I instantly notice your smile, ${N1}. It lights up the whole space and automatically makes me relax.` },
  { id: 'h1_002', heat: 1, answer: `The story about you and your brother building that terrible treehouse. ${N2}, you tell it with such joy.` },
  { id: 'h1_003', heat: 1, answer: `That soft little sigh you make right before you fall asleep on my shoulder.` },
  { id: 'h1_004', heat: 1, answer: `Home used to be a place, but now home is wherever you are, ${N1}.` },
  { id: 'h2_001', heat: 2, answer: `When you wear that dark green shirt, ${N2}... I can't focus on anything else.` },
  { id: 'h2_005', heat: 2, answer: `It's so hot when you take charge of the plans for our evenings.` },
  { id: 'h3_010', heat: 3, answer: `I love the way your hands feel when you pull me close right after we wake up.` },
  { id: 'h4_020', heat: 4, answer: `That time we couldn't even make it to the bedroom... I still think about it, ${N1}.` }
];

const CALENDAR_EVENTS = [
  { title: `Dinner Date at ${N1}'s favorite spot`, type: 'dateNight' },
  { title: `Movie Night In - ${N2}'s turn to pick`, type: 'dateNight' },
  { title: `Hiking trip upstate`, type: 'general' },
  { title: `Coffee date before work`, type: 'dateNight' },
  { title: `Sunday Brunch with friends`, type: 'general' },
  { title: `${N1}'s parents visiting`, type: 'general' }
];

const VIBES = ['happy', 'cozy', 'tired', 'playful', 'stressed', 'adventurous', 'romantic', 'focused', 'grateful'];
const MOODS = ['Excellent', 'Good', 'Okay', 'Rough', 'Awful'];
const INTIMACY_LEVELS = [1, 2, 3, 4, 5];

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

export async function seedReviewerData() {
  const user = await supabase.auth.getUser();
  if (!user?.data?.user?.email?.toLowerCase().includes('betweenusreviewer')) {
    console.warn('Seeder: This script is restricted to reviewer accounts only.');
    return { success: false, error: 'Restricted' };
  }

  console.log('Seeder: Starting the 90 day backfill for Alex & Jordan...');
  
  let stats = { journals: 0, vibes: 0, checkIns: 0, prompts: 0, memories: 0, calendar: 0 };
  let memoryIndex = 0;
  let promptIndex = 0;

  for (let i = 90; i >= 0; i--) {
      const isJournalDay = Math.random() < 0.25;      // ~22 journals
      const isVibeDay = Math.random() < 0.5;          // ~45 vibes
      const isCheckInDay = Math.random() < 0.3;       // ~27 check-ins
      const isPromptDay = Math.random() < 0.15;       // ~13 prompts
      const isMemoryDay = Math.random() < 0.1;        // ~9 memories
      const isCalendarDay = Math.random() < 0.15;     // ~13 events
      const d = randomDate(i);

      try {
          if (isVibeDay) {
            await DataLayer.saveVibe({
              vibe: VIBES[Math.floor(Math.random() * VIBES.length)],
              note: Math.random() > 0.5 ? (Math.random() > 0.5 ? `Thinking about ${N1}.` : `Can't wait to see ${N2} later.`) : '',
              _createdAt: d.toISOString(),
              _updatedAt: d.toISOString(),
            });
            stats.vibes++;
          }

          if (isCheckInDay) {
            await DataLayer.saveCheckIn({
              mood: MOODS[Math.floor(Math.random() * MOODS.length)],
              intimacy: INTIMACY_LEVELS[Math.floor(Math.random() * INTIMACY_LEVELS.length)],
              notes: Math.random() > 0.5 ? `Just checking in. Everything feels solid right now with ${Math.random() > 0.5 ? N1 : N2}.` : '',
              touch: Math.random() > 0.3, // usually true
              _createdAt: d.toISOString(),
              _updatedAt: d.toISOString(),
            });
            stats.checkIns++;
          }

          if (isJournalDay) {
            const body = JOURNAL_SNIPPETS[Math.floor(Math.random() * JOURNAL_SNIPPETS.length)];
            await DataLayer.saveJournalEntry({
              title: i % 7 === 0 ? 'Weekly Reflection' : 'Daily Thought',
              body,
              mood: MOODS[Math.floor(Math.random() * MOODS.length)],
              isPrivate: false,
              _createdAt: d.toISOString(),
              _updatedAt: d.toISOString(),
            });
            stats.journals++;
          }

          if (isPromptDay && promptIndex < PROMPT_PAIRS.length) {
            const p = PROMPT_PAIRS[promptIndex];
            await DataLayer.savePromptAnswer({
              promptId: p.id,
              answer: p.answer,
              heatLevel: p.heat,
              _createdAt: d.toISOString(),
              _updatedAt: d.toISOString(),
            });
            promptIndex++;
            stats.prompts++;
          }

          if (isMemoryDay && memoryIndex < MEMORIES.length) {
            const m = MEMORIES[memoryIndex];
            await DataLayer.saveMemory({
              content: m.content,
              mood: m.mood,
              type: m.type,
              isPrivate: false,
              _createdAt: d.toISOString(),
              _updatedAt: d.toISOString(),
            });
            memoryIndex++;
            stats.memories++;
          }

          if (isCalendarDay) {
            const evt = CALENDAR_EVENTS[Math.floor(Math.random() * CALENDAR_EVENTS.length)];
            const when = new Date(d);
            when.setHours(19, 0, 0, 0); // 7pm usually
            await DataLayer.saveCalendarEvent({
              title: evt.title,
              eventType: evt.type,
              whenTs: when.getTime(),
              isDateNight: evt.type === 'dateNight',
              location: Math.random() > 0.5 ? 'Downtown' : '',
              notes: 'Added from Demo Seeder',
              createdAt: d.getTime(),
              updatedAt: d.getTime(),
            });
            stats.calendar++;
          }

      } catch (err) {
          console.warn('Seeder err at day', i, err.message);
      }
  }

  // Force final sync so it uploads securely to Supabase
  if (SyncEngine.isConfigured) {
    try {
      await SyncEngine.sync();
    } catch {}
  }

  console.log(`Seeder Complete: ${JSON.stringify(stats)}`);
  return { success: true, ...stats };
}
