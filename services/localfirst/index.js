/**
 * Between Us — Cloud-first data architecture (Supabase)
 *
 * Barrel export for the data layer.
 *
 * Usage in screens/contexts:
 *   import { DataLayer } from '../services/localfirst';
 *
 * NOTE: SupabaseDataLayer is now the active implementation. Legacy
 * E2EE exports have been removed.
 */

export { default as DataLayer } from '../data/SupabaseDataLayer';
export { default as Database } from '../db/Database';
