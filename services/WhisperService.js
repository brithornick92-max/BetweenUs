/**
 * WhisperService.js — Ephemeral voice notes backed by Supabase Storage.
 *
 * Audio is uploaded as-is to the private `whispers` bucket. Access control is
 * handled by Supabase Auth, RLS, and HTTPS. Local files are only temporary
 * recording/playback cache and are deleted after upload/playback.
 */

import * as FileSystem from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { supabase, TABLES } from '../config/supabase';
import { bytesFromBase64 } from '../utils/base64Bytes';

const WHISPER_BUCKET = 'whispers';

async function upload({ fileUri, coupleId, senderId, durationMs }) {
  if (!supabase) throw new Error('WhisperService: Supabase not configured');
  if (!fileUri || !coupleId || !senderId) {
    throw new Error('WhisperService: fileUri, coupleId, and senderId are required');
  }

  const whisperId = `${coupleId}_${senderId}_${randomUUID()}`;
  const storagePath = `${coupleId}/${whisperId}.m4a`;
  const fileB64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = bytesFromBase64(fileB64);

  const { error: uploadError } = await supabase.storage
    .from(WHISPER_BUCKET)
    .upload(storagePath, bytes, {
      contentType: 'audio/mp4',
      upsert: false,
    });

  if (uploadError) throw new Error(`WhisperService upload: ${uploadError.message}`);

  const { error: metaError } = await supabase
    .from(TABLES.COUPLE_DATA)
    .insert({
      couple_id: coupleId,
      data_type: 'whisper',
      key: whisperId,
      created_by: senderId,
      is_private: false,
      value: {
        whisper_id: whisperId,
        storage_path: storagePath,
        sender_id: senderId,
        duration_ms: durationMs,
        played: false,
        created_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

  if (metaError) {
    await supabase.storage.from(WHISPER_BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`WhisperService metadata: ${metaError.message}`);
  }

  await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});

  return { whisperId };
}

async function getPending({ coupleId, userId }) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(TABLES.COUPLE_DATA)
    .select('*')
    .eq('couple_id', coupleId)
    .eq('data_type', 'whisper')
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data
    .map((row) => row.value)
    .filter((w) => w && w.sender_id !== userId && !w.played);
}

async function downloadForPlayback({ whisper }) {
  if (!supabase) throw new Error('WhisperService: Supabase not configured');

  const { data, error } = await supabase.storage
    .from(WHISPER_BUCKET)
    .download(whisper.storage_path);

  if (error || !data) throw new Error(`WhisperService download: ${error?.message}`);

  const localUri = `${FileSystem.cacheDirectory}whisper_${Date.now()}.m4a`;
  const bytes = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parts = String(reader.result || '').split(',');
      const b64 = parts.length >= 2 ? parts[1] : parts[0];
      if (!b64) {
        reject(new Error('Invalid data URL format from Blob'));
        return;
      }
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(data);
  });

  await FileSystem.writeAsStringAsync(localUri, bytes, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return localUri;
}

async function deleteAfterPlay({ whisper, coupleId, localUri }) {
  if (localUri) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
  }

  if (!supabase) return;

  const { error: metaError } = await supabase
    .from(TABLES.COUPLE_DATA)
    .update({
      value: { ...whisper, played: true },
      updated_at: new Date().toISOString(),
    })
    .eq('couple_id', coupleId)
    .eq('key', whisper.whisper_id);

  if (metaError) {
    if (__DEV__) console.warn(`[WhisperService] Failed to mark whisper as played: ${metaError.message}`);
    return;
  }

  await supabase.storage
    .from(WHISPER_BUCKET)
    .remove([whisper.storage_path])
    .catch(() => {});
}

export default {
  upload,
  getPending,
  downloadForPlayback,
  deleteAfterPlay,
};
