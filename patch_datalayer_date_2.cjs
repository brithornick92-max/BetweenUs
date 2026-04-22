const fs = require('fs');
const path = 'services/data/DataLayer.js';
let content = fs.readFileSync(path, 'utf8');

// Patch saveMemory
content = content.replace(
  /async saveMemory\(\{([\s\S]*?)\}\) \{/g,
  `async saveMemory({ $1, _createdAt, _updatedAt }) {`
);
content = content.replace(
  /is_private: isPrivate,\s+created_at: new Date\(\)\.toISOString\(\),\s+updated_at: new Date\(\)\.toISOString\(\)/g,
  `is_private: isPrivate,
      created_at: _createdAt || new Date().toISOString(),
      updated_at: _updatedAt || new Date().toISOString()`
);

// Patch savePromptAnswer
content = content.replace(
  /async savePromptAnswer\(\{ promptId, answer, heatLevel \}\) \{/g,
  `async savePromptAnswer({ promptId, answer, heatLevel, _createdAt, _updatedAt }) {`
);
content = content.replace(
  /const draft = \{ \.\.\.existing, \.\.\.updates, updated_at: new Date\(\)\.toISOString\(\) \};/g,
  `const draft = { ...existing, ...updates, updated_at: _updatedAt || new Date().toISOString() };`
);
content = content.replace(
  /is_revealed: 0,\s+created_at: new Date\(\)\.toISOString\(\),\s+updated_at: new Date\(\)\.toISOString\(\)/g,
  `is_revealed: 0,
          created_at: _createdAt || new Date().toISOString(),
          updated_at: _updatedAt || new Date().toISOString()`
);

// Update date_key calculation in savePromptAnswer
content = content.replace(
  /const dk = dateKey\(\);/g,
  `const dk = _createdAt ? dateKey(new Date(_createdAt)) : dateKey();`
);

fs.writeFileSync(path, content);
console.log('patched saveMemory and savePromptAnswer dates');
