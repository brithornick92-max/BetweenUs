const fs = require('fs');

let content = fs.readFileSync('utils/DemoSeeder.js', 'utf8');

const replacementLoop = `
  for (let i = 90; i >= 0; i--) {
      const isJournalDay = Math.random() < 0.25;      // ~22 journals
      const isVibeDay = Math.random() < 0.5;          // ~45 vibes
      const isCheckInDay = Math.random() < 0.3;       // ~27 check-ins
      const isPromptDay = Math.random() < 0.15;       // ~13 prompts
      const isMemoryDay = Math.random() < 0.1;        // ~9 memories
      const isCalendarDay = Math.random() < 0.15;     // ~13 events
      const d = randomDate(i);
      const isPartner = Math.random() < 0.5;

      try {
          if (isVibeDay) {
            const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
            const note = Math.random() > 0.5 ? (Math.random() > 0.5 ? \`Thinking about \${N1}.\` : \`Can't wait to see \${N2} later.\`) : '';
            if (!isPartner) {
              await DataLayer.saveVibe({ vibe, note, _createdAt: d.toISOString(), _updatedAt: d.toISOString() });
            } else {
              const noteCipher = note ? await E2EEncryption.encryptString(note, kt, coupleId) : null;
              const dk = d.toISOString();
              const rowId = Database.makeId('vib');
              await Database.executeRaw(\`INSERT INTO vibes (id, user_id, couple_id, vibe, note_cipher, created_at, updated_at, sync_status, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', 0)\`, [rowId, partnerId, coupleId, vibe, noteCipher, dk, dk]);
            }
            stats.vibes++;
          }

          if (isCheckInDay) {
            const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
            const intimacy = INTIMACY_LEVELS[Math.floor(Math.random() * INTIMACY_LEVELS.length)];
            const notes = Math.random() > 0.5 ? \`Just checking in. Everything feels solid right now with \${Math.random() > 0.5 ? N1 : N2}.\` : '';
            const touch = Math.random() > 0.3;
            if (!isPartner) {
              await DataLayer.saveCheckIn({ mood, intimacy, notes, touch, _createdAt: d.toISOString(), _updatedAt: d.toISOString() });
            } else {
              const dk = d.toISOString();
              const dateK = d.toISOString().split('T')[0];
              const bodyCipher = await E2EEncryption.encryptJson({ mood, intimacy, notes, touch }, kt, coupleId);
              const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, coupleId) : null;
              const rowId = Database.makeId('chk');
              await Database.executeRaw(\`INSERT INTO check_ins (id, user_id, couple_id, body_cipher, mood, mood_cipher, date_key, created_at, updated_at, sync_status, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)\`, [rowId, partnerId, coupleId, bodyCipher, mood, moodCipher, dateK, dk, dk]);
            }
            stats.checkIns++;
          }

          if (isJournalDay) {
            const body = JOURNAL_SNIPPETS[Math.floor(Math.random() * JOURNAL_SNIPPETS.length)];
            const title = i % 7 === 0 ? 'Weekly Reflection' : 'Daily Thought';
            const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
            if (!isPartner) {
              await DataLayer.saveJournalEntry({ title, body, mood, isPrivate: false, _createdAt: d.toISOString(), _updatedAt: d.toISOString() });
            } else {
              const titleCipher = await E2EEncryption.encryptString(title, kt, coupleId);
              const bodyCipher = await E2EEncryption.encryptString(body, kt, coupleId);
              const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, coupleId) : null;
              const dk = d.toISOString();
              const rowId = Database.makeId('jrnl');
              await Database.executeRaw(\`INSERT INTO journal_entries (id, user_id, couple_id, title_cipher, body_cipher, mood_cipher, is_private, created_at, updated_at, sync_status, sync_version) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'synced', 0)\`, [rowId, partnerId, coupleId, titleCipher, bodyCipher, moodCipher, dk, dk]);
            }
            stats.journals++;
          }

          if (isPromptDay && promptIndex < PROMPT_PAIRS.length) {
            const p = PROMPT_PAIRS[promptIndex];
            if (!isPartner) {
              await DataLayer.savePromptAnswer({ promptId: p.id, answer: p.answer, heatLevel: p.heat, _createdAt: d.toISOString(), _updatedAt: d.toISOString() });
            } else {
              const answerCipher = await E2EEncryption.encryptString(p.answer, kt, coupleId);
              const heatCipher = await E2EEncryption.encryptString(String(p.heat), kt, coupleId);
              const dkDate = d.toISOString().split('T')[0];
              const dk = d.toISOString();
              const rowId = Database.makeId('prm');
              await Database.executeRaw(\`INSERT INTO prompt_answers (id, user_id, couple_id, prompt_id, date_key, answer_cipher, heat_level, heat_level_cipher, created_at, updated_at, sync_status, sync_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', 0)\`, [rowId, partnerId, coupleId, p.id, dkDate, answerCipher, p.heat, heatCipher, dk, dk]);
            }
            promptIndex++;
            stats.prompts++;
          }

          if (isMemoryDay && memoryIndex < MEMORIES.length) {
            const m = MEMORIES[memoryIndex];
            if (!isPartner) {
              await DataLayer.saveMemory({ content: m.content, mood: m.mood, type: m.type, isPrivate: false, _createdAt: d.toISOString(), _updatedAt: d.toISOString() });
            } else {
              const bodyCipher = await E2EEncryption.encryptString(m.content, kt, coupleId);
              const moodCipher = m.mood ? await E2EEncryption.encryptString(m.mood, kt, coupleId) : null;
              const dk = d.toISOString();
              const rowId = Database.makeId('mem');
              await Database.executeRaw(\`INSERT INTO memories (id, user_id, couple_id, moment_type, mood_cipher, body_cipher, is_private, created_at, updated_at, sync_status, sync_version) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'synced', 0)\`, [rowId, partnerId, coupleId, m.type, moodCipher, bodyCipher, dk, dk]);
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
              const dkTs = when.getTime();
              const dk = d.toISOString();
              const rowId = Database.makeId('cal');
              await Database.executeRaw(\`INSERT INTO calendar_events_local (id, user_id, couple_id, title_cipher, location_cipher, notes_cipher, event_type, when_ts, is_date_night, notify, notify_mins, metadata_cipher, created_at, updated_at, sync_status, sync_version, sync_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 60, ?, ?, ?, 'synced', 0, 'remote')\`, [rowId, partnerId, coupleId, titleCipher, locCipher, notesCipher, evt.type, dkTs, evt.type === 'dateNight' ? 1 : 0, metaCipher, dk, dk]);
            }
            stats.calendar++;
          }

      } catch (err) {
          console.warn('Seeder err at day', i, err.message);
      }
  }
`;

const startIndex = content.indexOf('for (let i = 90; i >= 0; i--) {');
const endIndex = content.indexOf('// Force final sync so it uploads securely to Supabase');

if (startIndex > -1 && endIndex > -1) {
  content = content.substring(0, startIndex) + replacementLoop + "\n  " + content.substring(endIndex);
  fs.writeFileSync('utils/DemoSeeder.js', content);
  console.log('patched');
} else {
  console.log('indices not found');
}
