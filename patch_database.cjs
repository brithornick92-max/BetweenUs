const fs = require('fs');
let dbPath = 'services/db/Database.js';
let content = fs.readFileSync(dbPath, 'utf8');

if (!content.includes('executeRaw')) {
  // Add before export default {
  content = content.replace('export default {', 'export default {\n  async executeRaw(sql, params = []) {\n    const db = await getDb();\n    return db.runAsync(sql, params);\n  },');
  fs.writeFileSync(dbPath, content);
  console.log('Database patched');
}
