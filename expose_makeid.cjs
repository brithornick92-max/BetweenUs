const fs = require('fs');
const dbPath = 'services/db/Database.js';
let db = fs.readFileSync(dbPath, 'utf8');

if (!db.includes('makeId: makeId,')) {
    db = db.replace('const Database = {', 'const Database = {\n  makeId,\n');
    fs.writeFileSync(dbPath, db);
    console.log('exposed');
}
