import { supabase } from "../config/supabase";
import SyncEngine from "../services/sync/SyncEngine";
import Database from "../services/db/Database";
import E2EEncryption from "../services/e2ee/E2EEncryption";
import EncryptedAttachments from "../services/e2ee/EncryptedAttachments";
import { Image } from 'react-native';

// ─── Demo media assets (bundled simulator photos/video) ─────────────
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

/**
 * Encrypt and store one demo media file; returns attachmentId or null.
 * Marks upload_status='uploaded' so SyncEngine never tries to push demo blobs.
 */
async function attachDemoMedia({ parentType, parentId, userId, coupleId, kt, encCoupleId }) {
  try {
    const assets = await resolveDemoAssets();
    const useVideo = Math.random() < 0.12 && !!assets.video;
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
    // Mark as uploaded so SyncEngine skips it; mark synced so it isn't pushed.
    await Database.markAttachmentUploaded(att.id, `demo://${att.id}`);
    await Database.markSynced('attachments', [att.id]);
    return att.id;
  } catch {
    return null;
  }
}

// Hardcoded names for the demo content
const N1 = "Alex";
const N2 = "Jordan";

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
  `We finally booked those concert tickets! ${N2} was so excited.`,
];

const MEMORIES = [
  {
    content: `${N1} trying to cook dinner and completely burning the pasta 😂`,
    mood: "Playful",
    type: "funny",
  },
  {
    content: `Our lazy Sunday watching movies in the rain.`,
    mood: "Cozy",
    type: "moment",
  },
  {
    content: `When ${N2} surprised me at the airport with flowers.`,
    mood: "Romantic",
    type: "milestone",
  },
  {
    content: `That hike where we got completely lost but found that hidden waterfall.`,
    mood: "Adventurous",
    type: "moment",
  },
  {
    content: `Celebrating ${N1}'s big promotion at work!`,
    mood: "Proud",
    type: "milestone",
  },
  {
    content: `Singing terribly in the car together all the way down the coast.`,
    mood: "Happy",
    type: "funny",
  },
];

const PROMPT_PAIRS = [
  {
    id: "h1_001",
    heat: 1,
    answer: `I instantly notice your smile, ${N1}. It lights up the whole space and automatically makes me relax.`,
  },
  {
    id: "h1_002",
    heat: 1,
    answer: `The story about you and your brother building that terrible treehouse. ${N2}, you tell it with such joy.`,
  },
  {
    id: "h1_003",
    heat: 1,
    answer: `That soft little sigh you make right before you fall asleep on my shoulder.`,
  },
  {
    id: "h1_004",
    heat: 1,
    answer: `Home used to be a place, but now home is wherever you are, ${N1}.`,
  },
  {
    id: "h2_001",
    heat: 2,
    answer: `When you wear that dark green shirt, ${N2}... I can't focus on anything else.`,
  },
  {
    id: "h2_005",
    heat: 2,
    answer: `It's so hot when you take charge of the plans for our evenings.`,
  },
  {
    id: "h3_010",
    heat: 3,
    answer: `I love the way your hands feel when you pull me close right after we wake up.`,
  },
  {
    id: "h4_020",
    heat: 4,
    answer: `That time we couldn't even make it to the bedroom... I still think about it, ${N1}.`,
  },
];

const CALENDAR_EVENTS = [
  { title: `Dinner Date at ${N1}'s favorite spot`, type: "dateNight" },
  { title: `Movie Night In - ${N2}'s turn to pick`, type: "dateNight" },
  { title: `Hiking trip upstate`, type: "general" },
  { title: `Coffee date before work`, type: "dateNight" },
  { title: `Sunday Brunch with friends`, type: "general" },
  { title: `${N1}'s parents visiting`, type: "general" },
];

const VIBES = [
  "happy",
  "cozy",
  "tired",
  "playful",
  "stressed",
  "adventurous",
  "romantic",
  "focused",
  "grateful",
];
const MOODS = ["Excellent", "Good", "Okay", "Rough", "Awful"];
const INTIMACY_LEVELS = [1, 2, 3, 4, 5];

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(
    8 + Math.floor(Math.random() * 14),
    Math.floor(Math.random() * 60),
    0,
    0
  );
  return d;
}

export async function seedReviewerData() {
  const user = await supabase.auth.getUser();
  if (!user?.data?.user?.email?.toLowerCase().includes("betweenusreviewer")) {
    console.warn(
      "Seeder: This script is restricted to reviewer accounts only."
    );
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
  const partnerId =
    cmData?.data?.find((m) => m.user_id !== myUserId)?.user_id ||
    "99999999-9999-9999-9999-999999999999";
  const coupleId =
    cmData?.data?.[0]?.couple_id || "00000000-0000-0000-0000-000000000000";

  // Probe whether the couple key is actually available on this device.
  // If not (key exchange hasn't completed yet), fall back to device-tier
  // encryption so partner rows are always inserted successfully.
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

  console.log(
    "Seeder: Starting the 90 day backfill for Alex & Jordan... (Includes partner data)"
  );

  let stats = {
    journals: 0,
    vibes: 0,
    checkIns: 0,
    prompts: 0,
    memories: 0,
    calendar: 0,
    media: 0,
  };
  // When kt is "device", coupleId must be null for E2EEncryption
  const encCoupleId = kt === "couple" ? coupleId : null;

  let memoryIndex = 0;
  let promptIndex = 0;

  for (let i = 90; i >= 0; i--) {
    const isJournalDay = Math.random() < 0.25; // ~22 journals
    const isVibeDay = Math.random() < 0.5; // ~45 vibes
    const isCheckInDay = Math.random() < 0.3; // ~27 check-ins
    const isPromptDay = Math.random() < 0.15; // ~13 prompts
    const isMemoryDay = Math.random() < 0.1; // ~9 memories
    const isCalendarDay = Math.random() < 0.15; // ~13 events
    const d = randomDate(i);
    const dk = d.toISOString();
    const splitDk = dk.split("T")[0];
    const isPartner = Math.random() < 0.5;
    // userId for this row — either the reviewer or the fake partner
    const rowUserId = isPartner ? partnerId : myUserId;
    // coupleId stored on the row — only set when we have a real couple
    const rowCoupleId = coupleId !== "00000000-0000-0000-0000-000000000000" ? coupleId : null;

    try {
      if (isVibeDay) {
        const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
        const note =
          Math.random() > 0.5
            ? Math.random() > 0.5
              ? `Thinking about ${N1}.`
              : `Can't wait to see ${N2} later.`
            : "";
        const noteCipher = note
          ? await E2EEncryption.encryptString(note, kt, encCoupleId)
          : null;
        const draft = {
          id: Database.makeId("vib"),
          user_id: rowUserId,
          couple_id: rowCoupleId,
          vibe,
          note_cipher: noteCipher,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertVibe(draft);
        await Database.markSynced("vibes", [draft.id]);
        stats.vibes++;
      }

      if (isCheckInDay) {
        const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
        const intimacy =
          INTIMACY_LEVELS[Math.floor(Math.random() * INTIMACY_LEVELS.length)];
        const notes =
          Math.random() > 0.5
            ? `Just checking in. Everything feels solid right now with ${
                Math.random() > 0.5 ? N1 : N2
              }.`
            : "";
        const touch = Math.random() > 0.3;
        const bodyCipher = await E2EEncryption.encryptJson(
          { mood, intimacy, notes, touch },
          kt,
          encCoupleId
        );
        const moodCipher = mood
          ? await E2EEncryption.encryptString(mood, kt, encCoupleId)
          : null;
        const draft = {
          id: Database.makeId("chk"),
          user_id: rowUserId,
          couple_id: rowCoupleId,
          body_cipher: bodyCipher,
          mood,
          mood_cipher: moodCipher,
          date_key: splitDk,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertCheckIn(draft);
        await Database.markSynced("check_ins", [draft.id]);
        stats.checkIns++;
      }

      if (isJournalDay) {
        const body =
          JOURNAL_SNIPPETS[Math.floor(Math.random() * JOURNAL_SNIPPETS.length)];
        const title = i % 7 === 0 ? "Weekly Reflection" : "Daily Thought";
        const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
        const titleCipher = await E2EEncryption.encryptString(
          title, kt, encCoupleId
        );
        const bodyCipher = await E2EEncryption.encryptString(
          body, kt, encCoupleId
        );
        const moodCipher = mood
          ? await E2EEncryption.encryptString(mood, kt, encCoupleId)
          : null;
        const journalId = Database.makeId("jrn");
        // ~35% of journal entries get a photo; ~10% of those get a video instead
        const journalMediaRef = Math.random() < 0.35
          ? await attachDemoMedia({ parentType: 'journal', parentId: journalId, userId: rowUserId, coupleId: rowCoupleId, kt, encCoupleId })
          : null;
        const draft = {
          id: journalId,
          user_id: rowUserId,
          couple_id: rowCoupleId,
          title_cipher: titleCipher,
          body_cipher: bodyCipher,
          mood,
          mood_cipher: moodCipher,
          tags: null,
          tags_cipher: null,
          is_private: false,
          photo_uri: null,
          media_ref: journalMediaRef,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertJournal(draft);
        await Database.markSynced("journal_entries", [draft.id]);
        stats.journals++;
      }

      if (isPromptDay && promptIndex < PROMPT_PAIRS.length) {
        const p = PROMPT_PAIRS[promptIndex];
        const answerCipher = await E2EEncryption.encryptString(
          p.answer, kt, encCoupleId
        );
        const heatCipher = await E2EEncryption.encryptString(
          String(p.heat), kt, encCoupleId
        );
        const draft = {
          id: Database.makeId("ans"),
          user_id: rowUserId,
          couple_id: rowCoupleId,
          prompt_id: p.id,
          date_key: splitDk,
          answer_cipher: answerCipher,
          heat_level: p.heat,
          heat_level_cipher: heatCipher,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertPromptAnswer(draft);
        await Database.markSynced("prompt_answers", [draft.id]);
        promptIndex++;
        stats.prompts++;
      }

      if (isMemoryDay && memoryIndex < MEMORIES.length) {
        const m = MEMORIES[memoryIndex];
        const bodyCipher = await E2EEncryption.encryptString(
          m.content, kt, encCoupleId
        );
        const moodCipher = m.mood
          ? await E2EEncryption.encryptString(m.mood, kt, encCoupleId)
          : null;
        const memoryId = Database.makeId("mem");
        // ~50% of memories get a photo — memories are milestone moments so
        // a real couple would almost always have a pic
        const memoryMediaRef = Math.random() < 0.5
          ? await attachDemoMedia({ parentType: 'memory', parentId: memoryId, userId: rowUserId, coupleId: rowCoupleId, kt, encCoupleId })
          : null;
        const draft = {
          id: memoryId,
          user_id: rowUserId,
          couple_id: rowCoupleId,
          is_private: 0,
          moment_type: m.type,
          title: null,
          title_cipher: null,
          body_cipher: bodyCipher,
          mood: m.mood,
          mood_cipher: moodCipher,
          tags: [],
          tags_cipher: null,
          media_ref: memoryMediaRef,
          created_at: dk,
          updated_at: dk,
        };
        await Database.insertMemory(draft);
        await Database.markSynced("memories", [draft.id]);
        memoryIndex++;
        stats.memories++;
      }

      if (isCalendarDay) {
        const evt =
          CALENDAR_EVENTS[Math.floor(Math.random() * CALENDAR_EVENTS.length)];
        const when = new Date(d);
        when.setHours(19, 0, 0, 0); // 7pm usually
        const loc = Math.random() > 0.5 ? "Downtown" : "";
        const notes = "Added from Demo Seeder";
        const titleCipher = await E2EEncryption.encryptString(
          evt.title, kt, encCoupleId
        );
        const locCipher = loc
          ? await E2EEncryption.encryptString(loc, kt, encCoupleId)
          : null;
        const notesCipher = await E2EEncryption.encryptString(
          notes, kt, encCoupleId
        );
        const metaCipher = await E2EEncryption.encryptJson(
          {
            isDateNight: evt.type === "dateNight",
            notify: false,
            notifyMins: 60,
            notificationId: null,
          },
          kt,
          encCoupleId
        );
        const draft = {
          id: Database.makeId("cal"),
          user_id: rowUserId,
          couple_id: rowCoupleId,
          title_cipher: titleCipher,
          location_cipher: locCipher,
          notes_cipher: notesCipher,
          event_type: evt.type,
          is_date_night: evt.type === "dateNight" ? 1 : 0,
          when_ts: when.getTime(),
          notify: 0,
          notify_mins: 60,
          notification_id: null,
          metadata_cipher: metaCipher,
          created_at: dk,
          updated_at: dk,
        };
        await Database.upsertCalendarEvent(draft, {
          syncStatus: "synced",
          syncSource: "remote",
        });
        stats.calendar++;
      }
    } catch (err) {
      console.warn("Seeder err at day", i, err.message);
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
