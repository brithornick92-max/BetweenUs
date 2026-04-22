const fs = require('fs');
const path = 'services/data/DataLayer.js';
let content = fs.readFileSync(path, 'utf8');

const helper = `
  async _writeCloudFirst(tableName, localDraft, offlineMethod, ...offlineArgs) {
    if (SyncEngine.isConfigured) {
      try {
        const remoteAcknowledge = await SyncEngine.pushSingleRecord(tableName, localDraft);
        // Hydrated!
        return remoteAcknowledge;
      } catch (err) {
        if (__DEV__) console.warn('[DataLayer] Cloud-first write failed:', err?.message);
      }
    }
    
    // Offline Path / Fallback
    const localResult = await Database[offlineMethod](...offlineArgs);
    debouncedPush();
    return localResult;
  },
`;

if (!content.includes('_writeCloudFirst(')) {
    content = content.replace('  async saveJournalEntry', helper + '\n  async saveJournalEntry');
    fs.writeFileSync(path, content);
    console.log('patched _writeCloudFirst');
} else {
    console.log('already patched');
}
