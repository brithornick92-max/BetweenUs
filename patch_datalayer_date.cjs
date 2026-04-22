const fs = require('fs');
const path = 'services/data/DataLayer.js';
let content = fs.readFileSync(path, 'utf8');

// We need to accept created_at and updated_at args
content = content.replace(
  /async saveJournalEntry\(\{([\s\S]*?)\}\) \{([\s\S]*?)const draft = \{/g,
  `async saveJournalEntry({ $1, _createdAt, _updatedAt }) { $2const draft = {`
);
content = content.replace(
  /media_ref: mediaRef,\s+created_at: new Date\(\)\.toISOString\(\),\s+updated_at: new Date\(\)\.toISOString\(\)/g,
  `media_ref: mediaRef,
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()`
);

content = content.replace(
  /async saveCheckIn\(\{([\s\S]*?)\}\) \{([\s\S]*?)const draft = \{/g,
  `async saveCheckIn({ $1, _createdAt, _updatedAt }) { $2const draft = {`
);
content = content.replace(
  /mood_cipher: moodCipher,\s+date_key: dateKey\(\),\s+created_at: new Date\(\)\.toISOString\(\),\s+updated_at: new Date\(\)\.toISOString\(\)/g,
  `mood_cipher: moodCipher,
      date_key: _createdAt ? dateKey(new Date(_createdAt)) : dateKey(),
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()`
);

content = content.replace(
  /async saveVibe\(\{ vibe, note \}\) \{([\s\S]*?)const draft = \{/g,
  `async saveVibe({ vibe, note, _createdAt, _updatedAt }) { $1const draft = {`
);
content = content.replace(
  /note_cipher: noteCipher,\s+created_at: new Date\(\)\.toISOString\(\),\s+updated_at: new Date\(\)\.toISOString\(\)/g,
  `note_cipher: noteCipher,
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()`
);

fs.writeFileSync(path, content);
console.log('patched data layer dates');
