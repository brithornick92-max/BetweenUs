const fs = require('fs');

const contentLoop = `
  for (let i = 90; i >= 0; i--) {
      const isJournalDay = Math.random() < 0.25;      // ~22 journals
      const isVibeDay = Math.random() < 0.5;          // ~45 vibes
      const isCheckInDay = Math.random() < 0.3;       // ~27 check-ins
      const isPromptDay = Math.random() < 0.15;       // ~13 prompts
      const isMemoryDay = Math.random() < 0.1;        // ~9 memories
      const isCalendarDay = Math.random() < 0.15;     // ~13 events
      const d = randomDate(i);
      const dk = d.toISOString();
      const splitDk = dk.split('T')[0];
      const isPartner = Math.random() < 0.5;

      try {
          if (isVibeDay) {
            const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
            const note = Math.random() > 0.5 ? (Math.random() > 0.5 ? \`Thinking about \${N1}.\` : \`Can't wait to see \${N2} later.\`) : '';
            if (!isPartner) {
              await DataLayer.saveVibe({ vibe, note, _createdAt: dk, _updatedAt: dk });
            } else {
              const noteCipher = note ? await E2EEncryption.encryptString(note, kt, coupleId) : null;
              const draft = { id: Database.makeId('vib'), user_id: partnerId, couple_id: coupleId, vibe, note_cipher: noteCipher, created_at: dk, updated_at: dk };
              await Database.insertVibe(draft);
              await Database.markSynced('vibes', [draft.id]);
            }
            stats.vibes++;
          }

          if (isCheckInDay) {
            const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
            const intimacy = INTIMACY_LEVELS[Math.floor(Math.random() * INTIMACY_LEVELS.length)];
            const notes = Math.random() > 0.5 ? \`Just checking in. Everything feels solid right now with \${Math.random() > 0.5 ? N1 : N2}.\` : '';
            const touch = Math.random() > 0.3;
            if (!isPartner) {
              await DataLayer.saveCheckIn({ mood, intimacy, notes, touch, _createdAt: dk, _updatedAt: dk });
            } else {
              const bodyCipher = await E2EEncryption.encryptJson({ mood, intimacy, notes, touch }, kt, coupleId);
              const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, coupleId) : null;
              const draft = { id: Database.makeId('chk'), user_id: partnerId, couple_id: coupleId, body_cipher: bodyCipher, mood, mood_cipher: moodCipher, date_key: splitDk, created_at: dk, updated_at: dk };
              await Database.insertCheckIn(draft);
              await Database.markSynced('check_ins', [draft.id]);
            }
            stats.checkIns++;
          }

          if (isJournalDay) {
            const body = JOURNAL_SNIPPETS[Math.floor(Math.random() * JOURNAL_SNIPPETS.length)];
            const title = i % 7 === 0 ? 'Weekly Reflection' : 'Daily Thought';
            const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
            if (!isPartner) {
              await DataLayer.saveJournalEntry({ title, body, mood, isPrivate: false, _createdAt: dk, _updatedAt: dk });
            } else {
              const titleCipher = await E2EEncryption.encryptString(title, kt, coupleId);
              const bodyCipher = await E2EEncryption.encryptString(body, kt, coupleId);
              const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, coupleId) : null;
              const draft = { id: Database.makeId('jrn'), user_id: partnerId, couple_id: coupleId, title_cipher: titleCipher, body_cipher: bodyCipher, mood, mood_cipher: moodCipher, tags: null, tags_cipher: null, is_private: false, photo_uri: null, media_ref: null, created_at: dk, updated_at: dk };
              await Database.insertJournal(draft);
              await Database.markSynced('journal_entries', [draft.id]);
            }
            stats.journals++;
          }

          if (isPromptDay && promptIndex < PROMPT_PAIRS.length) {
            const p = PROMPT_PAIRS[promptIndex];
            if (!isPartner) {
              await DataLayer.savePromptAnswer({ promptId: p.id, answer: p.answer, heatLevel: p.heat, _createdAt: dk, _updatedAt: dk });
            } else {
              const answerCipher = await E2EEncryption.encryptString(p.answer, kt, coupleId);
              const heatCipher = await E2EEncryption.encryptString(String(p.heat), kt, coupleId);
              const draft = { id: Database.makeId('ans'), user_id: partnerId, couple_id: coupleId, prompt_id: p.id, date_key: splitDk, answer_cipher: answerCipher, heat_level: p.heat, heat_level_cipher: heatCipher, created_at: dk, updated_at: dk };
              await Database.insertPromptAnswer(draft);
              await Database.markSynced('prompt_answers', [draft.id]);
            }
            promptIndex++;
            stats.prompts++;
          }

          if (isMemoryDay && memoryIndex < MEMORIES.length) {
            const m = MEMORIES[memoryIndex];
            if (!isPartner) {
              await DataLayer.saveMemory({ content: m.content, mood: m.mood, type: m.type, isPrivate: false, _createdAt: dk, _updatedAt: dk });
            } else {
              const bodyCipher = await E2EEncryption.encryptString(m.content, kt, coupleId);
              const moodCipher = m.mood ? await E2EEncryption.encryptString(m.mood, kt, coupleId) : null;
              const draft = { id: Database.makeId('mem'), user_id: partnerId, couple_id: coupleId, is_private: 0, moment_type: m.type, title: null, title_cipher: null, body_cipher: bodyCipher, mood: m.mood, mood_cipher: moodCipher, tags: [], tags_cipher: null, media_ref: null, created_at: dk, updated_at: dk };
              await Database.insertMemory(draft);
              await Database.markSynced('memories', [draft.id]);
            }
            memoryIndex++;
            stats.memories++;
          }

          if (isCalendarDay) {
            const evt = CALENDAR_EVENTS[Math.floor(Math.random() * CALENDAR_EVENTS.length)];
            const when = new Date(d);
            when.setHours(19, 0, 0, 0); // 7pm usually
            if (!isPartner) {
              await DataLayer.saveCalendarEvent({ title: evt.title, eventType: evt.type, whenTs: when.getTime(), isDateNight: evt.type === 'dateNight', location: Math.random() > 0.5 ? 'Downtown' : '', notes: 'Added from Demo Seeder', createdAt: d.getTime(), updatedAt: d.getTime() });
            } else {
              const loc = Math.random() > 0.5 ? 'Downtown' : '';
              const notes = 'Added from Demo Seeder';
              const titleCipher = await E2EEncryption.encryptString(evt.title, kt, coupleId);
              const locCipher = loc ? await E2EEncryption.encryptString(loc, kt, coupleId) : null;
              const notesCipher = await E2EEncryption.encryptString(notes, kt, coupleId);
              const metaCipher = await E2EEncryption.encryptJson({ isDateNight: evt.type === 'dateNight', notify: false, notifyMins: 60, notificationId: null }, kt, coupleId);
              const draft = { id: Database.makeId('cal'), user_id: partnerId, couple_id: coupleId, title_cipher: titleCipher, location_cipher: locCipher, notes_cipher: notesCipher, event_type: evt.type, is_date_night: evt.type === 'dateNight' ? 1 : 0, when_ts: when.getTime(), notify: 0, notify_mins: 60, notification_id: null, metadata_cipher: metaCipher, created_at: dk, updated_at: dk };
              await Database.upsertCalendarEvent(draft, { syncStatus: 'synced', syncSource: 'remote' });
            }
            stats.calendar++;
          }

      } catch (err) {
          console.warn('Seeder err at day', i, err.message);
      }
  }
`;

let demoSrc = fs.readFileSync('utils/DemoSeeder.js', 'utf8');
const startIndex = demoSrc.indexOf('for (let i = 90; i >= 0; i--) {');
const endIndex = demoSrc.indexOf('// Force final sync so it uploads securely to Supabase');

if (startIndex > -1 && endIndex > -1) {
  demoSrc = demoSrc.substring(0, startIndex) + contentLoop + "\n  " + demoSrc.substring(endIndex);
  fs.writeFileSync('utils/DemoSeeder.js', demoSrc);
  console.log('patched');
} else {
  console.log('indices not found');
}
