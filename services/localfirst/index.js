/**
 * Between Us — Cloud-first data architecture (Supabase)
 *
 * Barrel export for the data layer.
 *
 * Usage in screens/contexts:
 *   import { DataLayer } from '../services/localfirst';
 *
 * NOTE: SupabaseDataLayer is now the active implementation.
 */

export { default as DataLayer } from '../data/SupabaseDataLayer';
export { default as Database } from '../db/Database';
