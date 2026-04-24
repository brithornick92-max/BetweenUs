/**
 * EncryptedAttachments.js — Attachment storage helper for Between Us
 *
 * E2EE has been removed. Attachments are stored as plain files in
 * Supabase Storage, protected by RLS + HTTPS.
 *
 * The public API surface is preserved so call sites don't break.
 */

import * as FileSystem from 'expo-file-system/legacy';
import Database from '../db/Database';
import { supabase } from '../../config/supabase';

const ATTACHMENT_DIR = `${FileSystem.documentDirectory}attachments/`;
const STORAGE_BUCKET = 'attachments';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(ATTACHMENT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ATTACHMENT_DIR, { intermediates: true });
  }
}

function makeAttachmentId() {
  const { randomUUID } = require('expo-crypto');
  return `att_${randomUUID()}`;
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

const EncryptedAttachments = {
  /**
   * Store a local file in app-managed cache and record it in SQLite.
   * No encryption — files are stored as-is.
   */
  async encryptAndStore({
    sourceUri, fileName, mimeType, userId, coupleId = null,
    parentType, parentId,
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

    return { ...row, id: attId, local_uri: localUri };
  },

  /**
   * Upload an attachment to Supabase Storage.
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

    const fileB64 = await FileSystem.readAsStringAsync(att.local_uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = Uint8Array.from(atob(fileB64), c => c.charCodeAt(0));

    const ext = extensionFromName(att.file_name) || extensionFromMime(att.mime_type);
    const remoteKey = `${att.couple_id}/${att.user_id}/${attachmentId}${ext}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(remoteKey, bytes, {
        contentType: att.mime_type || 'application/octet-stream',
        upsert: true,
      });
    if (error) throw error;

    await Database.markAttachmentUploaded(attachmentId, remoteKey);
    return remoteKey;
  },

  /**
   * Upload all pending attachments.
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
   * Downloads from Supabase if not cached locally.
   */
  async getDecryptedUri(attachmentId) {
    await ensureDir();
    const db = await Database.init();
    const att = await db.getFirstAsync(
      'SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL',
      [attachmentId]
    );
    if (!att) throw new Error(`Attachment ${attachmentId} not found`);

    let localUri = att.local_uri;
    if (localUri) {
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) localUri = null;
    }

    if (!localUri && att.remote_key && supabase) {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(att.remote_key);
      if (error) throw error;

      const bytes = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const parts = reader.result.split(',');
          const b64 = parts.length >= 2 ? parts[1] : parts[0];
          if (!b64) { reject(new Error('Invalid data URL format from Blob')); return; }
          const byteArray = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          resolve(byteArray);
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
        reader.readAsDataURL(data);
      });

      const ext = extensionFromName(att.file_name) || extensionFromMime(att.mime_type) || '.bin';
      localUri = `${FileSystem.cacheDirectory}${attachmentId}_cache${ext}`;
      const b64Out = btoa(String.fromCharCode(...bytes));
      await FileSystem.writeAsStringAsync(localUri, b64Out, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (!localUri) throw new Error('Attachment file not available');
    return localUri;
  },

  /**
   * Delete attachment (soft-delete in DB, remove local file).
   */
  async deleteAttachment(attachmentId) {
    const db = await Database.init();
    const att = await db.getFirstAsync(
      'SELECT local_uri FROM attachments WHERE id = ?',
      [attachmentId]
    );

    if (att?.local_uri) {
      try { await FileSystem.deleteAsync(att.local_uri, { idempotent: true }); } catch { /* ok */ }
    }

    const ts = new Date().toISOString();
    await db.runAsync(
      `UPDATE attachments SET deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [ts, ts, attachmentId]
    );
  },

  /**
   * Clean up cached files (call periodically or on backgrounding).
   */
  async clearDecryptedCache() {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      for (const file of files) {
        if (file.includes('_cache.') || file.includes('_dec.')) {
          await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
        }
      }
    } catch { /* ok */ }
  },
};

export default EncryptedAttachments;
