import { supabase } from '../../config/supabase';

function getSupabaseClient() {
  if (!supabase?.from) throw new Error('Supabase is not configured');
  return supabase;
}

function isDateShortlistCoupleDuplicateError(error) {
  if (!error || error.code !== '23505') return false;

  const details = [
    error.message,
    error.details,
    error.hint,
    error.constraint,
  ].filter(Boolean).join(' ');

  return /date_shortlist_couple_date_unique|date_shortlist.*couple_id.*date_id/i.test(details);
}

async function restoreCoupleShortlistRow(client, coupleId, dateId) {
  const { data, error } = await client
    .from('date_shortlist')
    .update({ removed_at: null })
    .eq('couple_id', coupleId)
    .eq('date_id', dateId)
    .select('date_id, created_at')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getDateShortlist(userId, coupleId = null) {
  if (!userId && !coupleId) return [];

  const supabase = getSupabaseClient();

  let query = supabase
    .from('date_shortlist')
    .select('date_id, created_at')
    .is('removed_at', null)
    .order('created_at', { ascending: false });

  query = coupleId ? query.eq('couple_id', coupleId) : query.eq('user_id', userId);

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

export async function addDateToShortlist(userId, dateId, coupleId = null) {
  if (!userId || !dateId) return null;

  const supabase = getSupabaseClient();

  if (coupleId) {
    const restoredCoupleRow = await restoreCoupleShortlistRow(supabase, coupleId, dateId);
    if (restoredCoupleRow) return restoredCoupleRow;

    const promoteLegacyRow = await supabase
      .from('date_shortlist')
      .update({ couple_id: coupleId, removed_at: null })
      .eq('user_id', userId)
      .eq('date_id', dateId)
      .select('date_id, created_at')
      .maybeSingle();

    if (promoteLegacyRow.error) throw promoteLegacyRow.error;
    if (promoteLegacyRow.data) return promoteLegacyRow.data;
  }

  const row = {
    user_id: userId,
    couple_id: coupleId || null,
    date_id: dateId,
    removed_at: null,
  };

  const writeQuery = coupleId
    ? supabase.from('date_shortlist').insert(row)
    : supabase.from('date_shortlist').upsert(row, { onConflict: 'user_id,date_id' });

  const { data, error } = await writeQuery
    .select('date_id, created_at')
    .single();

  if (error) {
    if (coupleId && isDateShortlistCoupleDuplicateError(error)) {
      const restoredCoupleRow = await restoreCoupleShortlistRow(supabase, coupleId, dateId);
      if (restoredCoupleRow) return restoredCoupleRow;
    }

    throw error;
  }

  return data;
}

export async function removeDateFromShortlist(userId, dateId, coupleId = null) {
  if ((!userId && !coupleId) || !dateId) return;

  const supabase = getSupabaseClient();

  let query = supabase
    .from('date_shortlist')
    .update({ removed_at: new Date().toISOString() })
    .eq('date_id', dateId);

  query = coupleId ? query.eq('couple_id', coupleId) : query.eq('user_id', userId);

  const { error } = await query;

  if (error) throw error;
}

export async function clearDateShortlist(userId, coupleId = null) {
  if (!userId && !coupleId) return;

  const supabase = getSupabaseClient();

  let query = supabase
    .from('date_shortlist')
    .update({ removed_at: new Date().toISOString() })
    .is('removed_at', null);

  query = coupleId ? query.eq('couple_id', coupleId) : query.eq('user_id', userId);

  const { error } = await query;

  if (error) throw error;
}
