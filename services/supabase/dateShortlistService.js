import * as SupabaseStorage from './SecureSupabaseStorage';

function getSupabaseClient() {
  const client =
    SupabaseStorage.supabase ||
    SupabaseStorage.supabaseClient ||
    SupabaseStorage.client ||
    SupabaseStorage.default;

  if (!client?.from) {
    throw new Error(
      'No Supabase client export found in services/supabase/SecureSupabaseStorage.js. Expected supabase, supabaseClient, client, or default.'
    );
  }

  return client;
}

export async function getDateShortlist(userId) {
  if (!userId) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('date_shortlist')
    .select('date_id, created_at')
    .eq('user_id', userId)
    .is('removed_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function addDateToShortlist(userId, dateId) {
  if (!userId || !dateId) return null;

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('date_shortlist')
    .upsert(
      {
        user_id: userId,
        date_id: dateId,
        removed_at: null,
      },
      { onConflict: 'user_id,date_id' }
    )
    .select('date_id, created_at')
    .single();

  if (error) throw error;

  return data;
}

export async function removeDateFromShortlist(userId, dateId) {
  if (!userId || !dateId) return;

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('date_shortlist')
    .update({ removed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('date_id', dateId);

  if (error) throw error;
}

export async function clearDateShortlist(userId) {
  if (!userId) return;

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('date_shortlist')
    .update({ removed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('removed_at', null);

  if (error) throw error;
}
