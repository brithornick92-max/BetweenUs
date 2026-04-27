/**
 * Legacy database facade.
 *
 * The app no longer opens a local database for canonical data. SupabaseDataLayer
 * is the source of truth and uses AsyncStorage only for cache/queue data.
 */

const emptyRows = [];

const Database = {
  makeId(prefix = 'row') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  },

  async init() {
    return null;
  },

  async close() {
    return true;
  },

  async wipeUserData() {
    return true;
  },

  async wipeAll() {
    return true;
  },

  async migrateUserId() {
    return true;
  },

  async getPendingSync() {
    return emptyRows;
  },

  async markSynced() {
    return true;
  },

  async getSyncMeta() {
    return null;
  },

  async setSyncMeta() {
    return true;
  },

  async batchUpsertFromRemote() {
    return { inserted: 0, updated: 0, skipped: 0 };
  },

  async upsertFromRemote() {
    return true;
  },

  async getJournals() {
    return emptyRows;
  },

  async getPromptAnswers() {
    return emptyRows;
  },

  async getMemories() {
    return emptyRows;
  },

  async getCheckIns() {
    return emptyRows;
  },

  async getVibes() {
    return emptyRows;
  },

  async getAttachmentById() {
    return null;
  },

  async getPendingAttachmentUploads() {
    return emptyRows;
  },

  async insertAttachment(entry = {}) {
    return { id: entry.id || this.makeId('att'), ...entry };
  },

  async markAttachmentUploaded() {
    return true;
  },
};

export default Database;
