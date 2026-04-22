import { supabase } from "../config/supabase";
import SyncEngine from "../services/sync/SyncEngine";
import Database from "../services/db/Database";
import E2EEncryption from "../services/e2ee/E2EEncryption";
import EncryptedAttachments from "../services/e2ee/EncryptedAttachments";
import { Image } from 'react-native';

const DEMO_IMAGE_MODULES = [
  require('../assets/simulator-media/between-us-date-night-1.png'),
  require('../assets/simulator-media/between-us-date-night-2.png'),
  require('../assets/simulator-media/between-us-date-night-3.png'),
];
const DEMO_VIDEO_MODULE = require('../assets/simulator-media/between-us-date-night-video.mp4');

let _demoAssets = null;
function resolveDemoAssets() {
  if (_demoAssets) return _demoAssets;
  try {
    const images = DEMO_IMAGE_MODULES.map((mod, idx) => {
      const src = Image.resolveAssetSource(mod);
      return src?.uri ? { uri: src.uri, name: `date-night-${idx + 1}.png`, mimeType: 'image/png' } : null;
    }).filter(Boolean);
    const videoSrc = Image.resolveAssetSource(DEMO_VIDEO_MODULE);
    const video = videoSrc?.uri ? { uri: videoSrc.uri, name: 'date-night.mp4', mimeType: 'video/mp4' } : null;
    _demoAssets = { images, video };
  } catch {
    _demoAssets = { images: [], video: null };
  }
  return _demoAssets;
}

async function attachDemoMedia({ parentType, parentId, userId, coupleId, kt, preferVideo = false }) {
  try {
    const assets = await resolveDemoAssets();
    const useVideo = preferVideo && !!assets.video;
    const asset = useVideo
      ? assets.video
      : assets.images[Math.floor(Math.random() * assets.images.length)];
    if (!asset?.uri) return null;
    const att = await EncryptedAttachments.encryptAndStore({
      sourceUri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType,
      userId,
      coupleId,
      parentType,
      parentId,
      keyTier: kt,
    });
    await Database.markAttachmentUploaded(att.id, `demo://${att.id}`);
    await Database.markSynced('attachments', [att.id]);
    return att.id;
  } catch {
    return null;
  }
}

const N1 = "Alex";
const N2 = "Jordan";

const JOURNAL_SNIPPETS = [
  `Today was incredible. We finally took that walk down by the river like we planned and ${N2} just looked amazing in the golden hour light.`,
  `Feeling a bit stressed about work, but having ${N1} to come home to makes everything better.`,
  `Can't stop thinking about our weekend trip. The cabin was perfectly cozy, and ${N2} made the best coffee every morning.`,
  `Just a quiet evening at home. Ordered pizza, watched a terrible movie, loved every second with ${N1}.`,
  `I am so grateful for how supportive ${N2} has been lately.`,
  `Had a small argument earlier with ${N1}. It was silly, but resolving it together means the world to me.`,
  `Wow, that new restaurant ${N2} found is definitely our new favorite spot.`,
  `Woke up feeling incredibly energized today. The coffee helped, but mostly it's waking up next to ${N1}.`,
  `Looking forward to the holidays. ${N2} and I need to start planning what we're going to bring.`,
  `${N1} looked so beautiful this morning making breakfast. Just had to write it down so I never forget this feeling.`,
  `Such a long week. So glad ${N2} surprised me with my favorite takeout.`,
  `I realized today how much I've grown since meeting ${N1}. I'm much more patient now.`,
  `We finally booked those concert tickets! ${N2} was so excited.`,
  `We kept the night simple and it still felt special. I think that is one of our strengths now.`,
  `We have been busy lately, but the way ${N2} still reaches for my hand reminds me we are okay.`,
  `Even on an ordinary Tuesday, ${N1} makes this life feel intentional.`,
];

const MEMORIES = [
  { content: `${N1} trying to cook dinner and completely burning the pasta.`, mood: "Playful", type: "funny" },
  { content: `Our lazy Sunday watching movies in the rain.`, mood: "Cozy", type: "moment" },
  { content: `When ${N2} surprised me at the airport with flowers.`, mood: "Romantic", type: "milestone" },
  { content: `That hike where we got completely lost but found that hidden waterfall.`, mood: "Adventurous", type: "moment" },
  { content: `Celebrating ${N1}'s big promotion at work.`, mood: "Proud", type: "milestone" },
  { content: `Singing terribly in the car together all the way down the coast.`, mood: "Happy", type: "funny" },
  { content: `That soft living room dance while dinner was still on the stove.`, mood: "Romantic", type: "moment" },
  { content: `The night we stayed up planning the next chapter of our year.`, mood: "Hopeful", type: "milestone" },
];

const PROMPT_PAIRS = [
  { id: "h1_001", heat: 1, answer: `I instantly notice your smile, ${N1}. It lights up the whole space and automatically makes me relax.` },
  { id: "h1_002", heat: 1, answer: `The story about you and your brother building that terrible treehouse. ${N2}, you tell it with such joy.` },
  { id: "h1_003", heat: 1, answer: `That soft little sigh you make right before you fall asleep on my shoulder.` },
  { id: "h1_004", heat: 1, answer: `Home used to be a place, but now home is wherever you are, ${N1}.` },
  { id: "h2_001", heat: 2, answer: `When you wear that dark green shirt, ${N2}... I can't focus on anything else.` },
  { id: "h2_005", heat: 2, answer: `It's so hot when you take charge of the plans for our evenings.` },
  { id: "h3_010", heat: 3, answer: `I love the way your hands feel when you pull me close right after we wake up.` },
  { id: "h4_020", heat: 4, answer: `That time we couldn't even make it to the bedroom... I still think about it, ${N1}.` },
];

const QUIZ_PAIRS = [
  { id: 'quiz_favorite_comfort_food', mine: 'Tomato soup and a grilled cheese with extra black pepper.', partner: 'Thai curry and cold sparkling water while we watch a cozy show.' },
  { id: 'quiz_best_weekend_start', mine: 'Coffee first, playlist second, then a long walk before brunch.', partner: 'Sleeping in, pancakes, and absolutely no calendar for a few hours.' },
  { id: 'quiz_stress_signal', mine: 'They get extra quiet and start reorganizing tiny things around the apartment.', partner: 'They ask for a hug before they can even explain what happened.' },
  { id: 'quiz_ideal_date_energy', mine: 'A low-pressure dinner out followed by a long drive and dessert.', partner: 'A night in with candles, takeout, and phones face down.' },
  { id: 'quiz_favorite_trip_memory', mine: 'Getting lost on the coastal road and finding that tiny bakery.', partner: 'The rainy cabin morning with cards, coffee, and nowhere to be.' },
  { id: 'quiz_smallest_love_language', mine: 'When they plug my phone in before bed because they know I forgot.', partner: 'When they save the last bite for me without saying anything.' },
];

const CALENDAR_EVENTS = [
  { title: `Dinner Date at ${N1}'s favorite spot`, type: "dateNight" },
  { title: `Movie Night In - ${N2}'s turn to pick`, type: "dateNight" },
  { title: `Hiking trip upstate`, type: "general" },
  { title: `Coffee date before work`, type: "dateNight" },
  { title: `Sunday Brunch with friends`, type: "general" },
  { title: `${N1}'s parents visiting`, type: "general" },
  { title: 'Bookstore browse and wine bar stop', type: 'dateNight' },
  { title: 'Midweek reset walk by the water', type: 'general' },
  { title: 'Cook something new together night', type: 'dateNight' },
  { title: 'Farmers market and flower run', type: 'general' },
];

const DATE_PLAN_VARIANTS = [
  { locationType: 'out', heat: 2, load: 2, style: 'cozy', steps: ['Leave work on time.', 'Share one appetizer and one dessert.', 'End the night with a walk and no phones.'] },
  { locationType: 'home', heat: 2, load: 1, style: 'low-key', steps: ['Order the good takeout.', 'Light the candles.', 'Watch one thing together, then talk on the couch.'] },
  { locationType: 'out', heat: 3, load: 3, style: 'playful', steps: ['Pick an outfit that feels fun.', 'Try somewhere new.', 'Take one photo together before heading home.'] },
  { locationType: 'mixed', heat: 2, load: 2, style: 'adventurous', steps: ['Start with coffee.', 'Do one small spontaneous stop.', 'Debrief the best part before bed.'] },
];

const JOURNAL_TITLES = ['Daily Thought', 'Little Things I Want To Remember', 'Us Lately', 'Today Felt Good', 'Weekly Reflection'];
const VIBES = ["happy", "cozy", "tired", "playful", "stressed", "adventurous", "romantic", "focused", "grateful"];
const MOODS = ["Excellent", "Good", "Okay", "Rough", "Awful"];
const INTIMACY_LEVELS = [1, 2, 3, 4, 5];
const VIBE_NOTES = [`Thinking about ${N1}.`, `Can't wait to see ${N2} later.`, 'Today feels lighter when we stay connected.', 'Missing you a little extra today.', 'Still smiling about last night.', 'Need a quiet evening together soon.'];
const CHECKIN_NOTES = [`Just checking in. Everything feels solid right now with ${N1}.`, `A little tired, but still feeling close to ${N2}.`, 'We are busy, but I still feel chosen.', 'Need a softer night together and some affection.', 'Feeling really grateful for our rhythm this week.', 'Could use a reset date soon, but we are okay.'];
const CALENDAR_LOCATIONS = ['Downtown', 'Riverside', 'At home', 'West Village', 'Neighborhood favorite', 'Uptown'];

function pickByIndex(items, index, offset = 0) {
  return items[(index + offset) % items.length];
}

function shouldCreate(day, every, offset = 0) {
  return ((90 - day) + offset) % every === 0;
}

function buildTimestamp(daysAgo, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function insertPromptAnswerRow({ userId, coupleId, promptId, answer, heat, dateKey, createdAt, kt, encCoupleId }) {
  const answerCipher = await E2EEncryption.encryptString(answer, kt, encCoupleId);
  const heatCipher = await E2EEncryption.encryptString(String(heat), kt, encCoupleId);
  const draft = {
    id: Database.makeId('ans'),
    user_id: userId,
    couple_id: coupleId,
    prompt_id: promptId,
    date_key: dateKey,
    answer_cipher: answerCipher,
    heat_level: heat,
    heat_level_cipher: heatCipher,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await Database.insertPromptAnswer(draft);
  await Database.markSynced('prompt_answers', [draft.id]);
  return draft.id;
}

async function insertDatePlanRow({ userId, coupleId, sourceEventId, title, variant, createdAt, kt, encCoupleId }) {
  const titleCipher = await E2EEncryption.encryptString(title, kt, encCoupleId);
  const bodyCipher = await E2EEncryption.encryptJson({
    locationType: variant.locationType,
    heat: variant.heat,
    load: variant.load,
    style: variant.style,
    steps: variant.steps,
  }, kt, encCoupleId);
  const draft = {
    id: Database.makeId('dp'),
    user_id: userId,
    couple_id: coupleId,
    source_event_id: sourceEventId,
    title_cipher: titleCipher,
    body_cipher: bodyCipher,
    created_at: createdAt,
    updated_at: createdAt,
  };
  await Database.upsertDatePlan(draft, { syncStatus: 'synced', syncSource: 'remote' });
  return draft.id;
}

async function clearReviewerData(myUserId, partnerId) {
  const userIds = [myUserId, partnerId].filter(
    (id) => id && id !== "99999999-9999-9999-9999-999999999999"
  );

  for (const uid of userIds) {
    try {
      const journals = await Database.getJournals(uid, { limit: 2000 });
      for (const row of journals) await Database.softDeleteJournal(row.id);

      const checkIns = await Database.getCheckIns(uid, { limit: 2000 });
      for (const row of checkIns) await Database.softDeleteCheckIn(row.id);

      const vibes = await Database.getVibes(uid, { limit: 2000 });
      for (const row of vibes) await Database.softDeleteVibe(row.id);

      const memories = await Database.getMemories(uid, { limit: 2000 });
      for (const row of memories) await Database.softDeleteMemory(row.id);

      const prompts = await Database.getPromptAnswers(uid, { limit: 2000 });
      for (const row of prompts) await Database.softDeletePromptAnswer(row.id);

      const events = await Database.getCalendarEvents(uid, { limit: 2000 });
      for (const row of events) await Database.softDeleteCalendarEvent(row.id);

      const plans = await Database.getDatePlans(uid, { limit: 2000 });
      for (const row of plans) await Database.softDeleteDatePlan(row.id);
    } catch (err) {
      console.warn("Seeder: clearReviewerData partial failure for", uid, err?.message);
    }
  }
  console.log("Seeder: Prior demo data cleared.");
}

export async function seedReviewerData() {
  const user = await supabase.auth.getUser();
  if (!user?.data?.user?.email?.toLowerCase().includes("betweenusreviewer")) {
    console.warn("Seeder: This script is restricted to reviewer accounts only.");
    return { success: false, error: "Restricted" };
  }

  const myUserId = user.data.user.id;
  const cmData = await supabase
    .from("couple_members")
    .select("couple_id, user_id")
    .eq(
      "couple_id",
      (
        await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", myUserId)
          .single()
      ).data?.couple_id
    );
  const partnerId = cmData?.data?.find((m) => m.user_id !== myUserId)?.user_id || "99999999-9999-9999-9999-999999999999";
  const coupleId = cmData?.data?.[0]?.couple_id || "00000000-0000-0000-0000-000000000000";

  let kt = "device";
  if (coupleId !== "00000000-0000-0000-0000-000000000000") {
    try {
      const { default: CoupleKeyService } = await import('../services/security/CoupleKeyService');
      const ck = await CoupleKeyService.getCoupleKey(coupleId);
      kt = ck ? "couple" : "device";
    } catch {
      kt = "device";
    }
  }

  await clearReviewerData(myUserId, partnerId);
  console.log("Seeder: Starting the 90 day backfill for Alex & Jordan... (Includes partner data)");

  const stats = {
    journals: 0,
    vibes: 0,
    checkIns: 0,
    prompts: 0,
    quizzes: 0,
    memories: 0,
    calendar: 0,
    datePlans: 0,
    media: 0,
  };

  const encCoupleId = kt === "couple" ? coupleId : null;
  let promptIndex = 0;
  let quizIndex = 0;

  for (let i = 89; i >= 0; i--) {
    const dayIndex = 89 - i;
    const baseTs = buildTimestamp(i, 9 + (dayIndex % 4), (dayIndex * 7) % 60);
    const dk = baseTs.toISOString();
    const splitDk = dk.split("T")[0];
    const isPartner = dayIndex % 2 === 1;
    const rowUserId = isPartner ? partnerId : myUserId;
    const otherUserId = isPartner ? myUserId : partnerId;
    const rowCoupleId = coupleId !== "00000000-0000-0000-0000-000000000000" ? coupleId : null;

    try {
      const vibe = pickByIndex(VIBES, dayIndex, isPartner ? 2 : 0);
      const vibeNote = shouldCreate(i, 2, isPartner ? 1 : 0) ? pickByIndex(VIBE_NOTES, dayIndex, isPartner ? 1 : 0) : '';
      const vibeDraft = {
        id: Database.makeId("vib"),
        user_id: rowUserId,
        couple_id: rowCoupleId,
        vibe,
        note_cipher: vibeNote ? await E2EEncryption.encryptString(vibeNote, kt, encCoupleId) : null,
        created_at: dk,
        updated_at: dk,
      };
      await Database.insertVibe(vibeDraft);
      await Database.markSynced("vibes", [vibeDraft.id]);
      stats.vibes++;

      if (!shouldCreate(i, 11, 3)) {
        const mood = pickByIndex(MOODS, dayIndex, isPartner ? 2 : 0);
        const checkInDraft = {
          id: Database.makeId("chk"),
          user_id: rowUserId,
          couple_id: rowCoupleId,
          body_cipher: await E2EEncryption.encryptJson({
            mood,
            intimacy: pickByIndex(INTIMACY_LEVELS, dayIndex, isPartner ? 1 : 0),
            notes: pickByIndex(CHECKIN_NOTES, dayIndex, isPartner ? 2 : 0),
            touch: !shouldCreate(i, 5, 2),
          }, kt, encCoupleId),
          mood,
          mood_cipher: await E2EEncryption.encryptString(mood, kt, encCoupleId),
          date_key: splitDk,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertCheckIn(checkInDraft);
        await Database.markSynced("check_ins", [checkInDraft.id]);
        stats.checkIns++;
      }

      if (!shouldCreate(i, 4, 1)) {
        const journalId = Database.makeId("jrn");
        const journalMood = pickByIndex(MOODS, dayIndex, isPartner ? 1 : 0);
        const journalMediaRef = shouldCreate(i, 3, 1)
          ? await attachDemoMedia({
              parentType: 'journal',
              parentId: journalId,
              userId: rowUserId,
              coupleId: rowCoupleId,
              kt,
              preferVideo: shouldCreate(i, 10, 3),
            })
          : null;
        const journalDraft = {
          id: journalId,
          user_id: rowUserId,
          couple_id: rowCoupleId,
          title_cipher: await E2EEncryption.encryptString(pickByIndex(JOURNAL_TITLES, dayIndex, shouldCreate(i, 7) ? 4 : 0), kt, encCoupleId),
          body_cipher: await E2EEncryption.encryptString(pickByIndex(JOURNAL_SNIPPETS, dayIndex, isPartner ? 3 : 0), kt, encCoupleId),
          mood: journalMood,
          mood_cipher: await E2EEncryption.encryptString(journalMood, kt, encCoupleId),
          tags: null,
          tags_cipher: null,
          is_private: false,
          photo_uri: null,
          media_ref: journalMediaRef,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertJournal(journalDraft);
        await Database.markSynced("journal_entries", [journalDraft.id]);
        if (journalMediaRef) stats.media++;
        stats.journals++;
      }

      if (shouldCreate(i, 2)) {
        const prompt = PROMPT_PAIRS[promptIndex % PROMPT_PAIRS.length];
        await insertPromptAnswerRow({ userId: rowUserId, coupleId: rowCoupleId, promptId: prompt.id, answer: prompt.answer, heat: prompt.heat, dateKey: splitDk, createdAt: dk, kt, encCoupleId });
        stats.prompts++;

        if (shouldCreate(i, 4, 1)) {
          await insertPromptAnswerRow({
            userId: otherUserId,
            coupleId: rowCoupleId,
            promptId: prompt.id,
            answer: `${pickByIndex(JOURNAL_SNIPPETS, dayIndex + 1).split('.')[0]}.`,
            heat: prompt.heat,
            dateKey: splitDk,
            createdAt: buildTimestamp(i, 21, (dayIndex * 11) % 60).toISOString(),
            kt,
            encCoupleId,
          });
          stats.prompts++;
        }
        promptIndex++;
      }

      if (shouldCreate(i, 2, 1)) {
        const memory = pickByIndex(MEMORIES, dayIndex, isPartner ? 2 : 0);
        const memoryId = Database.makeId("mem");
        const memoryMediaRef = !shouldCreate(i, 5, 4)
          ? await attachDemoMedia({
              parentType: 'memory',
              parentId: memoryId,
              userId: rowUserId,
              coupleId: rowCoupleId,
              kt,
              preferVideo: shouldCreate(i, 8, 2),
            })
          : null;
        const memoryDraft = {
          id: memoryId,
          user_id: rowUserId,
          couple_id: rowCoupleId,
          type: memory.type,
          body_cipher: await E2EEncryption.encryptString(memory.content, kt, encCoupleId),
          media_ref: memoryMediaRef,
          mood: memory.mood,
          mood_cipher: await E2EEncryption.encryptString(memory.mood, kt, encCoupleId),
          is_private: 0,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertMemory(memoryDraft);
        await Database.markSynced("memories", [memoryDraft.id]);
        if (memoryMediaRef) stats.media++;
        stats.memories++;
      }

      if (shouldCreate(i, 4) || shouldCreate(i, 9, 2)) {
        const event = pickByIndex(CALENDAR_EVENTS, dayIndex, isPartner ? 1 : 0);
        const calendarDraft = {
          id: Database.makeId("cal"),
          user_id: rowUserId,
          couple_id: rowCoupleId,
          title_cipher: await E2EEncryption.encryptString(event.title, kt, encCoupleId),
          location_cipher: await E2EEncryption.encryptString(pickByIndex(CALENDAR_LOCATIONS, dayIndex, isPartner ? 3 : 0), kt, encCoupleId),
          notes_cipher: await E2EEncryption.encryptString(
            event.type === 'dateNight'
              ? 'Planned together after talking about what would help us reconnect this week.'
              : `Shared plan that reflects how often ${N1} and ${N2} coordinate life together.`,
            kt,
            encCoupleId
          ),
          event_type: event.type,
          is_date_night: event.type === 'dateNight' ? 1 : 0,
          when_ts: buildTimestamp(i, event.type === 'dateNight' ? 19 : 11 + (dayIndex % 4), event.type === 'dateNight' ? 0 : 30).getTime(),
          notify: 0,
          notify_mins: 60,
          notification_id: null,
          metadata_cipher: await E2EEncryption.encryptJson({ isDateNight: event.type === 'dateNight', notify: false, notifyMins: 60, notificationId: null }, kt, encCoupleId),
          created_at: dk,
          updated_at: dk,
        };
        await Database.upsertCalendarEvent(calendarDraft, { syncStatus: 'synced', syncSource: 'remote' });
        stats.calendar++;

        if (event.type === 'dateNight') {
          await insertDatePlanRow({
            userId: rowUserId,
            coupleId: rowCoupleId,
            sourceEventId: calendarDraft.id,
            title: event.title,
            variant: pickByIndex(DATE_PLAN_VARIANTS, dayIndex, isPartner ? 1 : 0),
            createdAt: dk,
            kt,
            encCoupleId,
          });
          stats.datePlans++;
        }
      }

      if (shouldCreate(i, 3, 2)) {
        const quiz = QUIZ_PAIRS[quizIndex % QUIZ_PAIRS.length];
        await insertPromptAnswerRow({ userId: myUserId, coupleId: rowCoupleId, promptId: quiz.id, answer: quiz.mine, heat: 1, dateKey: splitDk, createdAt: buildTimestamp(i, 20, (dayIndex * 9) % 60).toISOString(), kt, encCoupleId });
        await insertPromptAnswerRow({ userId: partnerId, coupleId: rowCoupleId, promptId: quiz.id, answer: quiz.partner, heat: 1, dateKey: splitDk, createdAt: buildTimestamp(i, 20, ((dayIndex * 9) + 17) % 60).toISOString(), kt, encCoupleId });
        stats.quizzes += 2;
        quizIndex++;
      }
    } catch (err) {
      console.warn("Seeder err at day", i, err.message);
    }
  }

  if (SyncEngine.isConfigured) {
    try {
      await SyncEngine.sync();
    } catch {}
  }

  console.log(`Seeder Complete: ${JSON.stringify(stats)}`);
  return { success: true, ...stats };
}
