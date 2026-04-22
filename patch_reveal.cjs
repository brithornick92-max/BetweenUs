const fs = require('fs');
const dbPath = 'services/db/Database.js';
let db = fs.readFileSync(dbPath, 'utf8');

if (!db.includes('getPromptAnswerById(id)')) {
    db = db.replace(
      'async getPromptAnswers(userId, { dateKey, promptId, limit = 100 } = {}) {',
      `async getPromptAnswerById(id) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM prompt_answers WHERE id = ?', [id]);
  },

  async getPromptAnswers(userId, { dateKey, promptId, limit = 100 } = {}) {`
    );
    fs.writeFileSync(dbPath, db);
    console.log('patched db');
}
