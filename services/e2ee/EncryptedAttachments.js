/**
 * EncryptedAttachments.js — E2EE file encrypt-before-upload for Between Us
 *
 * Flow:
 *   1. Pick / capture image or file
 *   2. Read bytes → encrypt with nacl.secretbox (couple or device key)
 *   3. Write encrypted blob to local cache (expo-file-system)
 *   4. Record in SQLite attachments table (local_uri, nonce, upload_status)
 *   5. Upload encrypted blob to Supabase Storage when online
 *   6. On download: fetch ciphertext → decrypt → return local URI
 *
 * Supabase Storage never sees plaintext. The nonce is stored in SQLite
 * (and synced to Supabase couple_data for cross-device access).
 */

import * as FileSystem from 'expo-file-system';
import naclUtil from 'tweetnacl-util';
import E2EEncryption from './E2EEncryption';
import Database from '../db/Database';
import { supabase } from '../../config/supabase';

const ENCRYPTED_DIR = `${FileSystem.documentDirectory}encrypted_attachments/`;
const STORAGE_BUCKET = 'attachments';

// ─── Ensure local encrypted cache directory exists ──────────────────

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(ENCRYPTED_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ENCRYPTED_DIR, { intermediates: true });
  }
}

// ─── helpers ────────────────────────────────────────────────────────

function makeAttachmentId() {
  return `att_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Read a local file URI into a Uint8Array.
 */
async function readFileAsBytes(uri) {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return naclUtil.decodeBase64(b64);
}

/**
 * Write a Uint8Array to a local file.
 */
async function writeBytesToFile(bytes, destUri) {
  const b64 = naclUtil.encodeBase64(bytes);
  await FileSystem.writeAsStringAsync(destUri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

// ─── Public API ─────────────────────────────────────────────────────

const EncryptedAttachments = {
  /**
   * Encrypt a local file and store the ciphertext locally.
   * Returns the SQLite attachment row.
   *
   * @param {Object} opts
   * @param {string} opts.sourceUri     — local file URI (e.g. from ImagePicker)
   * @param {string} opts.fileName      — original file name
   * @param {string} opts.mimeType      — e.g. 'image/jpeg'
   * @param {string} opts.userId
   * @param {string|null} opts.coupleId
   * @param {string} opts.parentType    — 'journal' | 'memory' | 'ritual'
   * @param {string} opts.parentId      — FK to parent row
   * @param {'device'|'couple'} opts.keyTier — which key to use
   */
  async encryptAndStore({
    sourceUri, fileName, mimeType, userId, coupleId = null,
    parentType, parentId, keyTier = 'couple',
  }) {
    await ensureDir();

    // 1. Read source file
    const plainBytes = await readFileAsBytes(sourceUri);

    // 2. Encrypt
    const { ciphertext, nonce } = await E2EEncryption.encryptFile(
      plainBytes, keyTier, coupleId
    );

    // 3. Write encrypted blob to local cache
    const attId = makeAttachmentId();
    const localUri = `${ENCRYPTED_DIR}${attId}.enc`;
    await writeBytesToFile(ciphertext, localUri);

    // 4. Encrypt the file name
    const fileNameCipher = await E2EEncryption.encryptString(
      fileName, keyTier, coupleId
    );

    // 5. Record in SQLite
    const row = await Database.insertAttachment({
      id: attId,
      user_id: userId,
      couple_id: coupleId,
      parent_type: parentType,
      parent_id: parentId,
      file_name_cipher: fileNameCipher,
      mime_type: mimeType,
      file_size: plainBytes.length,
      local_uri: localUri,
      encryption_nonce: nonce,
    });

    return { ...row, id: attId, local_uri: localUri, nonce };
  },

  /**
   * Upload an encrypted attachment to Supabase Storage.
   * Returns the remote storage key.
   */
  async uploadToRemote(attachmentId) {
    if (!supabase) throw new Error('Supabase not configured');

    const db = await Database.init();
    const att = await db.getFirstAsync(
      'SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL',
      [attachmentId]
    );
    if (!att) throw new Error(`Attachment ${attachmentId} not found`);
    if (!att.local_uri) throw new Error('No local file to upload');

    // Read encrypted bytes
    const encryptedB64 = await FileSystem.readAsStringAsync(att.local_uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const encryptedBytes = naclUtil.decodeBase64(encryptedB64);

    // Upload to Supabase Storage
    const remoteKey = `${att.couple_id || att.user_id}/${attachmentId}.enc`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(remoteKey, encryptedBytes, {
        contentType: 'application/octet-stream',
        upsert: true,
      });
    if (error) throw error;

    // Mark as uploaded in SQLite
    await Database.markAttachmentUploaded(attachmentId, remoteKey);
    return remoteKey;
  },

  /**
   * Upload all pending attachments (called by SyncEngine).
   */
  async uploadAllPending() {
    const pending = await Database.getPendingAttachmentUploads();
    const results = { uploaded: 0, failed: 0 };

    for (const att of pending) {
      try {
        await this.uploadToRemote(att.id);
        results.uploaded++;
      } catch (err) {
        console.warn(`[Attachments] Upload failed for ${att.id}:`, err.message);
        results.failed++;
      }
    }
    return results;
  },

  /**
   * Decrypt and return a local file URI for display.
   * If the file isn't cached locally, downloads from Supabase first.
   *
   * @param {string} attachmentId
   * @param {'device'|'couple'} keyTier
   * @param {string|null} coupleId
   * @returns {Promise<string>} — local URI to decrypted temp file
   */
  async getDecryptedUri(attachmentId, keyTier = 'couple', coupleId = null) {
    await ensureDir();
    const db = await Database.init();
    const att = await db.getFirstAsync(
      'SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL',
      [attachmentId]
    );
    if (!att) throw new Error(`Attachment ${attachmentId} not found`);

    // Check if we have the encrypted file locally
    let encryptedUri = att.local_uri;
    if (encryptedUri) {
      const info = await FileSystem.getInfoAsync(encryptedUri);
      if (!info.exists) encryptedUri = null;
    }

    // If not local, download from Supabase
    if (!encryptedUri && att.remote_key && supabase) {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(att.remote_key);
      if (error) throw error;

      const arrayBuffer = await data.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      encryptedUri = `${ENCRYPTED_DIR}${attachmentId}.enc`;
      await writeBytesToFile(bytes, encryptedUri);
    }

    if (!encryptedUri) throw new Error('Attachment file not available');

    // Decrypt to a temp file
    const cipherBytes = await readFileAsBytes(encryptedUri);
    const plainBytes = await E2EEncryption.decryptFile(
      cipherBytes, att.encryption_nonce, keyTier, coupleId
    );

    const ext = att.mime_type ? att.mime_type.split('/')[1] || 'bin' : 'bin';
    const decryptedUri = `${FileSystem.cacheDirectory}${attachmentId}_dec.${ext}`;
    await writeBytesToFile(plainBytes, decryptedUri);

    return decryptedUri;
  },

  /**
   * Delete attachment (soft-delete in DB, optionally remove local file).
   */
  async deleteAttachment(attachmentId) {
    const db = await Database.init();
    const att = await db.getFirstAsync(
      'SELECT local_uri FROM attachments WHERE id = ?',
      [attachmentId]
    );

    // Clean up local encrypted file
    if (att?.local_uri) {
      try { await FileSystem.deleteAsync(att.local_uri, { idempotent: true }); } catch { /* ok */ }
    }

    // Soft-delete in DB (will sync the deletion to Supabase)
    const ts = new Date().toISOString();
    await db.runAsync(
      `UPDATE attachments SET deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [ts, ts, attachmentId]
    );
  },

  /**
   * Clean up decrypted cache files (call periodically or on backgrounding).
   */
  async clearDecryptedCache() {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      for (const file of files) {
        if (file.includes('_dec.')) {
          await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
        }
      }
    } catch { /* ok */ }
  },
};

export default EncryptedAttachments;
