/**
 * Between Us — Local-first + E2EE + Supabase Sync
 *
 * Barrel export for the new data architecture.
 *
 * Usage in screens/contexts:
 *   import { DataLayer, SyncEngine, E2EEncryption } from '../services/localfirst';
 */

export { default as Database } from '../db/Database';
export { default as E2EEncryption } from '../e2ee/E2EEncryption';
export { default as EncryptedAttachments } from '../e2ee/EncryptedAttachments';
export { default as SyncEngine } from '../sync/SyncEngine';
export { default as DataLayer } from '../data/DataLayer';
