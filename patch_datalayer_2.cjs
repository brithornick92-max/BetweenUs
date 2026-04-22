const fs = require('fs');
const path = 'services/data/DataLayer.js';
let content = fs.readFileSync(path, 'utf8');

// Replace standard Database inserts with cloud-first versions
// 1. saveJournalEntry
content = content.replace(
  /const row = await Database\.insertJournal\(\{\s+user_id: _userId,([\s\S]*?) media_ref: mediaRef,\n\s+\}\);/,
  `const entryForDb = {
      id: Database.makeId('jrn'),
      user_id: _userId,
      $1 media_ref: mediaRef,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const row = await this._writeCloudFirst('journal_entries', entryForDb, 'insertJournal', entryForDb);`
);

// 2. updateJournalEntry
content = content.replace(
  /const row = await Database\.updateJournal\(id, updates\);/,
  `updates.id = id;
    updates.updated_at = new Date().toISOString();
    const existing = await Database.getJournalById(id);
    const rowDraft = { ...existing, ...updates };
    const row = await this._writeCloudFirst('journal_entries', rowDraft, 'updateJournal', id, updates);`
);

// 3. deleteJournalEntry
content = content.replace(
  /await Database\.softDeleteJournal\(id\);/,
  `const existing = await Database.getJournalById(id);
    if (existing) {
       const rowDraft = { ...existing, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
       await this._writeCloudFirst('journal_entries', rowDraft, 'softDeleteJournal', id);
    }`
);

// 4. savePromptAnswer (insert branch)
content = content.replace(
  /const row = await Database\.insertPromptAnswer\(\{([\s\S]*?)\}\);/g,
  function(match, inner) {
      if (inner.includes('id: payload?.id')) return match; // legacy migration skip
      return `const entryForDb = {
        id: Database.makeId('ans'),
        ${inner.trim()},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const row = await this._writeCloudFirst('prompt_answers', entryForDb, 'insertPromptAnswer', entryForDb);`;
  }
);

// 4.1 savePromptAnswer (update branch)
content = content.replace(
  /const row = await Database\.updatePromptAnswer\(existing\.id, \{([\s\S]*?)\}\);/,
  `const updates = { $1 };
      updates.updated_at = new Date().toISOString();
      const rowDraft = { ...existing, ...updates };
      const row = await this._writeCloudFirst('prompt_answers', rowDraft, 'updatePromptAnswer', existing.id, updates);`
);

// 5. revealPromptAnswer
content = content.replace(
  /const row = await Database\.updatePromptAnswer\(id, \{([\s\S]*?)\}\);/,
  `const updates = { $1 };
    updates.updated_at = new Date().toISOString();
    const existingForReveal = await Database.getPromptAnswers(_userId, { promptId: id }); // wait this might return array
    const actualExisting = existingForReveal?.find(r => r.id === id) || { id };
    const rowDraft = { ...actualExisting, ...updates };
    const row = await this._writeCloudFirst('prompt_answers', rowDraft, 'updatePromptAnswer', id, updates);`
);

// 6. saveMemory
content = content.replace(
  /const row = await Database\.insertMemory\(\{([\s\S]*?)\}\);/,
  `const entryForDb = {
      id: Database.makeId('mem'),
      ${inner => { /* didn't use inner correctly above wait */ return ''; }}
    };`
);

fs.writeFileSync(path + '.mod', content);
