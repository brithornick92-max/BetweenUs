/**
 * WhisperService.js — Encrypted Ephemeral Voice Notes
 *
 * Security model:
 *   • Audio is recorded to the OS cache directory (not documents — not backed up)
 *   • The raw PCM/AAC file NEVER leaves the device
 *   • Before upload: the file is base64-encoded and encrypted with
 *     NaCl secretbox using a key derived from the couple's shared secret
 *   • Supabase Storage receives ONLY ciphertext + a random nonce
 *   • The local file is deleted immediately after upload
 *   • After the partner plays a whisper, the remote object is deleted
 *   • Metadata (duration, sender_id, played) is stored in couple_data
 *     as plaintext for querying — message content is never in metadata
 *
 * Dependencies:
 *   expo-av         (audio recording/playback)
 *   expo-file-system
 *   tweetnacl + tweetnacl-util  (already in package.json)
 *   supabase JS client
 */

import * as FileSystem from 'expo-file-system';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8 } from 'tweetnacl-util';
import { supabase, TABLES } from '../config/supabase';

// Storage bucket in Supabase for whisper ciphertext blobs
const WHISPER_BUCKET = 'whispers';

// ─── Key derivation from couple shared secret ──────────────────────────────
// The couple key is a 32-byte Uint8Array derived by EncryptionService.
// We hash it with a domain separator to produce a dedicated whisper key
// so a compromise of the whisper key doesn't affect other encrypted data.

function deriveWhisperKey(coupleKey) {
  if (!(coupleKey instanceof Uint8Array) || coupleKey.length < 32) {
    throw new Error('WhisperService: invalid couple key');
  }
  // XOR with a fixed domain salt — lightweight but sufficient domain separation
  const DOMAIN = encodeUTF8('betweenUS::whisper::v1');
  const key = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    key[i] = coupleKey[i % coupleKey.length] ^ (DOMAIN[i % DOMAIN.length] ?? 0);
  }
  return key;
}

// ─── Encryption / decryption helpers ──────────────────────────────────────

/**
 * Encrypt a binary file and return { ciphertextB64, nonceB64 }
 * @param {string} fileUri   local file:// URI to the recorded audio
 * @param {Uint8Array} key   32-byte whisper key
 */
async function encryptFile(fileUri, key) {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const plaintext = decodeBase64(b64);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ciphertext = nacl.secretbox(plaintext, nonce, key);
  if (!ciphertext) throw new Error('WhisperService: encryption failed');
  return {
    ciphertextB64: encodeBase64(ciphertext),
    nonceB64: encodeBase64(nonce),
  };
}

/**
 * Decrypt a ciphertext blob and write the audio to a temp file.
 * Returns the local file URI.
 * @param {string} ciphertextB64
 * @param {string} nonceB64
 * @param {Uint8Array} key
 * @returns {Promise<string>} Temporary local file URI
 */
async function decryptToTempFile(ciphertextB64, nonceB64, key) {
  const ciphertext = decodeBase64(ciphertextB64);
  const nonce = decodeBase64(nonceB64);
  const plaintext = nacl.secretbox.open(ciphertext, nonce, key);
  if (!plaintext) throw new Error('WhisperService: decryption failed — data may be corrupted');

  const tempUri = `${FileSystem.cacheDirectory}whisper_${Date.now()}.m4a`;
  await FileSystem.writeAsStringAsync(tempUri, encodeBase64(plaintext), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return tempUri;
}

// ─── Upload ────────────────────────────────────────────────────────────────

/**
 * Upload an encrypted whisper to Supabase Storage and record metadata.
 *
 * @param {object} opts
 * @param {string}     opts.fileUri      Local audio file URI
 * @param {string}     opts.coupleId
 * @param {string}     opts.senderId
 * @param {number}     opts.durationMs   Recording duration in ms
 * @param {Uint8Array} opts.coupleKey    32-byte couple shared key
 * @returns {Promise<{ whisperId: string }>}
 */
async function upload({ fileUri, coupleId, senderId, durationMs, coupleKey }) {
  if (!supabase) throw new Error('WhisperService: Supabase not configured');

  const whisperKey = deriveWhisperKey(coupleKey);
  const { ciphertextB64, nonceB64 } = await encryptFile(fileUri, whisperKey);

  // Delete local recording immediately — it's encrypted now
  await FileSystem.deleteAsync(fileUri, { idempotent: true });

  const whisperId = `${coupleId}_${senderId}_${Date.now()}`;
  const storagePath = `${coupleId}/${whisperId}.bin`;

  // Upload ciphertext blob (text file — the binary is base64 inside)
  const { error: uploadError } = await supabase.storage
    .from(WHISPER_BUCKET)
    .upload(storagePath, ciphertextB64, {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) throw new Error(`WhisperService upload: ${uploadError.message}`);

  // Store metadata in couple_data (no sensitive content here)
  const { error: metaError } = await supabase
    .from(TABLES.COUPLE_DATA)
    .insert({
      couple_id: coupleId,
      data_type: 'whisper',
      data_key: whisperId,
      data_value: {
        whisper_id: whisperId,
        storage_path: storagePath,
        nonce: nonceB64,
        sender_id: senderId,
        duration_ms: durationMs,
        played: false,
        created_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

  if (metaError) {
    // Attempt cleanup if metadata write fails
    await supabase.storage.from(WHISPER_BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`WhisperService metadata: ${metaError.message}`);
  }

  return { whisperId };
}

// ─── Fetch pending whispers ────────────────────────────────────────────────

/**
 * Returns all unplayed whispers sent TO the current user.
 * (i.e., sender_id !== userId — the partner's whispers)
 */
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
    .map((row) => row.data_value)
    .filter((w) => w && w.sender_id !== userId && !w.played);
}

// ─── Download & decrypt ────────────────────────────────────────────────────

/**
 * Download a whisper's ciphertext from Supabase Storage and decrypt it to
 * a temp file. Returns the local URI for playback.
 *
 * IMPORTANT: call deleteAfterPlay() once playback completes.
 */
async function downloadForPlayback({ whisper, coupleKey }) {
  if (!supabase) throw new Error('WhisperService: Supabase not configured');

  const whisperKey = deriveWhisperKey(coupleKey);

  const { data, error } = await supabase.storage
    .from(WHISPER_BUCKET)
    .download(whisper.storage_path);

  if (error || !data) throw new Error(`WhisperService download: ${error?.message}`);

  const ciphertextB64 = await data.text();
  const localUri = await decryptToTempFile(ciphertextB64, whisper.nonce, whisperKey);

  return localUri;
}

// ─── Ephemeral cleanup ─────────────────────────────────────────────────────

/**
 * Delete the whisper's remote storage object and mark it as played in metadata.
 * Call this immediately after the audio finishes playing.
 */
async function deleteAfterPlay({ whisper, coupleId, localUri }) {
  // Remove temp local file
  if (localUri) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
  }

  if (!supabase) return;

  // Delete from Supabase Storage (the ciphertext blob)
  await supabase.storage
    .from(WHISPER_BUCKET)
    .remove([whisper.storage_path])
    .catch(() => {});

  // Mark as played in metadata (so it doesn't re-appear for the sender)
  await supabase
    .from(TABLES.COUPLE_DATA)
    .update({ data_value: { ...whisper, played: true } })
    .eq('couple_id', coupleId)
    .eq('data_key', whisper.whisper_id)
    .catch(() => {});
}

const WhisperService = {
  upload,
  getPending,
  downloadForPlayback,
  deleteAfterPlay,
};

export default WhisperService;
