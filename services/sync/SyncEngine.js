/**
 * Legacy sync facade.
 *
 * SupabaseDataLayer now talks directly to Supabase. This facade is kept only
 * for old imports and reports no local work.
 */

const noopResult = { pushed: 0, pulled: 0, attachments: { uploaded: 0, failed: 0 } };

const SyncEngine = {
  isConfigured: false,
  configure() {
    this.isConfigured = true;
  },
  async reset() {
    this.isConfigured = false;
  },
  async sync() {
    return noopResult;
  },
  async pushNow() {
    return noopResult;
  },
  async pullNow() {
    return noopResult;
  },
  subscribeRealtime() {
    return () => {};
  },
  onSyncEvent() {
    return () => {};
  },
  async wipeLocalCache() {
    return true;
  },
};

export default SyncEngine;
