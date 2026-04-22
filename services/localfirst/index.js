/**
 * Between Us — Cloud-first data architecture (Supabase)
 *
 * Barrel export for the data layer.
 *
 * Usage in screens/contexts:
 *   import { DataLayer } from '../services/localfirst';
 *
 * NOTE: SupabaseDataLayer is now the active implementation. The legacy
 * SQLite/E2EE/SyncEngine stack (DataLayer, Database, SyncEngine,
 * E2EEncryption, EncryptedAttachments) is kept in place for the one-time
 * migrateLegacyStorage() path and will be removed in a future cleanup.
 */

export { default as DataLayer } from '../data/SupabaseDataLayer';

// Legacy exports — still importable during the migration window but not
// used by any screen or context in normal operation.
export { default as Database } from '../db/Database';
export { default as E2EEncryption } from '../e2ee/E2EEncryption';
export { default as EncryptedAttachments } from '../e2ee/EncryptedAttachments';
export { default as SyncEngine } from '../sync/SyncEngine';
