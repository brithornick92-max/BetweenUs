/**
 * EncryptedAttachments.js — Attachment storage helper for Between Us
 *
 * Flow:
 *   1. Pick / capture image or file
 *   2. Copy the local file into app-managed cache
 *   3. Record it in SQLite attachments table
 *   4. Upload raw bytes to Supabase Storage when online
 *   5. On download: fetch and cache locally for display
 *
 * Legacy encrypted attachments are still supported on read/download paths so
 * older rows remain accessible during the migration.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as naclUtil from 'tweetnacl-util';
import E2EEncryption from './E2EEncryption';
import Database from '../db/Database';
import { supabase } from '../../config/supabase';

const ATTACHMENT_DIR = `${FileSystem.documentDirectory}attachments/`;
const STORAGE_BUCKET = 'attachments';

// ─── Ensure local attachment directory exists ───────────────────────

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(ATTACHMENT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENT_DIR, { intermediates: true });
  }
}

// ─── helpers ────────────────────────────────────────────────────────

function makeAttachmentId() {
  // Use crypto-safe randomness for attachment IDs
  const { randomUUID } = require('expo-crypto');
  return `att_${randomUUID()}`;
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

function extensionFromName(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0) return '';
  return fileName.slice(lastDot);
}

function extensionFromMime(mimeType) {
  if (!mimeType || typeof mimeType !== 'string' || !mimeType.includes('/')) return '';
  const ext = mimeType.split('/')[1] || '';
  return ext ? `.${ext}` : '';
}

// ─── Public API ─────────────────────────────────────────────────────

const EncryptedAttachments = {
  /**
   * Store a local file in app-managed cache.
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
   * @param {'device'|'couple'} opts.keyTier — retained for backward-compatible call sites
   */
  async encryptAndStore({
    sourceUri, fileName, mimeType, userId, coupleId = null,
    parentType, parentId, keyTier = 'couple',
  }) {
    await ensureDir();
    const attId = makeAttachmentId();
    const ext = extensionFromName(fileName) || extensionFromMime(mimeType);
    const localUri = `${ATTACHMENT_DIR}${attId}${ext}`;
    await FileSystem.copyAsync({ from: sourceUri, to: localUri });
    const info = await FileSystem.getInfoAsync(localUri);

    const row = await Database.insertAttachment({
      id: attId,
      user_id: userId,
      couple_id: coupleId,
      parent_type: parentType,
      parent_id: parentId,
      file_name: fileName || `${attId}${ext}`,
      file_name_cipher: null,
      mime_type: mimeType,
      file_size: info?.size ?? null,
      local_uri: localUri,
      encryption_nonce: null,
    });

    return { ...row, id: attId, local_uri: localUri, keyTier };
  },

  /**
   * Upload an attachment to Supabase Storage.
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

    // Read local file bytes
    const encryptedB64 = await FileSystem.readAsStringAsync(att.local_uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const encryptedBytes = naclUtil.decodeBase64(encryptedB64);

    // Upload to Supabase Storage
    const suffix = att.encryption_nonce ? '.enc' : (extensionFromName(att.file_name) || extensionFromMime(att.mime_type));
    const remoteKey = `${att.couple_id}/${att.user_id}/${attachmentId}${suffix}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(remoteKey, encryptedBytes, {
        contentType: att.mime_type || 'application/octet-stream',
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
    const { data } = await supabase.auth.getUser();
    const activeUserId = data?.user?.id || null;
    if (!activeUserId) return { uploaded: 0, failed: 0 };

    const pending = await Database.getPendingAttachmentUploads(activeUserId);
    const results = { uploaded: 0, failed: 0 };

    for (const att of pending) {
      try {
        await this.uploadToRemote(att.id);
        results.uploaded++;
      } catch (err) {
        if (__DEV__) console.warn(`[Attachments] Upload failed for ${att.id}:`, err.message);
        results.failed++;
      }
    }
    return results;
  },

  /**
   * Return a local file URI for display.
   * If the file isn't cached locally, downloads from Supabase first.
   * Legacy encrypted blobs are still decrypted on demand.
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

    // Check if we have the file locally
    let localUri = att.local_uri;
    if (localUri) {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) localUri = null;
    }

    // If not local, download from Supabase
    if (!localUri && att.remote_key && supabase) {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(att.remote_key);
      if (error) throw error;

      // Supabase returns a Blob; Hermes doesn't support Blob.arrayBuffer()
      // so read it via FileReader as base64 instead.
      const bytes = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const parts = reader.result.split(',');
          const b64 = parts.length >= 2 ? parts[1] : parts[0];
          if (!b64) {
            reject(new Error('Invalid data URL format from Blob'));
            return;
          }
          resolve(naclUtil.decodeBase64(b64));
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsDataURL(data);
      });
      const ext = extensionFromName(att.file_name) || extensionFromMime(att.mime_type) || '.bin';
      localUri = att.encryption_nonce
        ? `${ATTACHMENT_DIR}${attachmentId}.enc`
        : `${FileSystem.cacheDirectory}${attachmentId}_cache${ext}`;
      await writeBytesToFile(bytes, localUri);
    }

    if (!localUri) throw new Error('Attachment file not available');

    if (!att.encryption_nonce) {
      return localUri;
    }

    // Decrypt to a temp file
    const cipherBytes = await readFileAsBytes(localUri);
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

    // Clean up local cached file
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
        if (file.includes('_dec.') || file.includes('_cache.')) {
          await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
        }
      }
    } catch { /* ok */ }
  },
};

export default EncryptedAttachments;
