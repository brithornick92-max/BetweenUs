/**
 * DataLayer.js — Cloud-first compatibility wrapper
 *
 * Supabase is the source of truth.
 *
 * This file intentionally delegates to SupabaseDataLayer so the rest of the app
 * can keep importing DataLayer without touching every screen/context.
 *
 * Local storage may still be used inside SupabaseDataLayer for cache/offline
 * queueing only. It should not be treated as the canonical data source.
 */

import SupabaseDataLayer from './SupabaseDataLayer';

export default SupabaseDataLayer;
