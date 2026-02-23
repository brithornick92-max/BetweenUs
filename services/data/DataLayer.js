/**
 * DataLayer.js — Unified local-first + E2EE data access layer
 *
 * This is the single entry point the rest of the app should use for
 * reading/writing user data. It:
 *
 *   1. Encrypts sensitive fields via E2EEncryption
 *   2. Writes to SQLite (instant, offline-first)
 *   3. Triggers background sync to Supabase (if premium + coupled)
 *
 * Think of it as a replacement for the scattered direct calls to
 * AsyncStorage / LocalStorageService. Screens and contexts import
 * DataLayer instead.
 *
 * Key tier rules:
 *   • If user has a coupleId → use 'couple' key (both can decrypt)
 *   • If solo (no partner) → use 'device' key (only this device)
 *
 * Everything is async, but reads hit SQLite (< 1ms) so the UI
 * never waits on the network.
 */

import Database from '../db/Database';
import E2EEncryption from '../e2ee/E2EEncryption';
import EncryptedAttachments from '../e2ee/EncryptedAttachments';
import SyncEngine from '../sync/SyncEngine';

// ─── Helpers ────────────────────────────────────────────────────────

let _userId = null;
let _coupleId = null;
let _coupleKeyAvailable = false;

/**
 * Determine the key tier for encryption.
 *
 * POLICY: If the user is coupled (_coupleId is set), shared content
 * MUST use 'couple' tier. We never silently fall back to 'device' for
 * shared content — that would produce ciphertext the partner can't read.
 *
 * If you need to check availability before writing, call
 * `DataLayer.canEncryptForCouple()` first. If it returns false,
 * the UI should show a "Reconnect to sync" banner.
 */
function keyTier() {
  return _coupleId ? 'couple' : 'device';
}

/**
 * For explicit solo/private content, always use device key regardless
 * of pairing state.
 */
function deviceTier() {
  return 'device';
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Debounced push — wait 500ms after the last write before pushing.
 * Batches rapid writes into a single sync cycle.
 */
let _pushTimer = null;
function debouncedPush() {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    SyncEngine.pushNow().catch(() => {});
  }, 500);
}

// ─── Init / teardown ────────────────────────────────────────────────

const DataLayer = {
  /**
   * Initialize the data layer. Call once at app start (after auth).
   */
  async init({ userId, coupleId, isPremium = false }) {
    _userId = userId;
    _coupleId = coupleId;

    // Check if the couple key is actually available
    if (coupleId) {
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(coupleId);
    } else {
      _coupleKeyAvailable = false;
    }

    await Database.init();

    SyncEngine.configure({ userId, coupleId, isPremium });

    // Initial pull from Supabase (get partner's latest data)
    if (isPremium && coupleId) {
      SyncEngine.pullNow().catch(err =>
        console.warn('[DataLayer] Initial pull failed:', err.message)
      );
    }
  },

  /**
   * Update config (e.g. when couple links, premium changes).
   */
  async reconfigure({ userId, coupleId, isPremium }) {
    if (userId) _userId = userId;
    if (coupleId !== undefined) _coupleId = coupleId;

    // Re-check couple key availability
    if (coupleId) {
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(coupleId);
    } else {
      _coupleKeyAvailable = false;
    }

    SyncEngine.configure({ userId, coupleId, isPremium });
  },

  /**
   * Check if we can encrypt/decrypt for the couple.
   * If false, the UI should show "Reconnect" and disable shared writes.
   */
  canEncryptForCouple() {
    return !!_coupleId && _coupleKeyAvailable;
  },

  /**
   * Returns true if the user is paired but couple key is missing.
   * UI should show a reconnect/re-pair banner.
   */
  needsReconnect() {
    return !!_coupleId && !_coupleKeyAvailable;
  },

  /**
   * Full reset (sign-out / account delete).
   */
  async reset() {
    _userId = null;
    _coupleId = null;
    _coupleKeyAvailable = false;
    E2EEncryption.clearCache();
    await SyncEngine.reset();
  },

  // ─── Journal ──────────────────────────────────────────────────

  async saveJournalEntry({ title, body, mood, tags, isPrivate = false }) {
    // Private entries always use device key; shared entries use couple key
    const kt = isPrivate ? deviceTier() : keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const titleCipher = await E2EEncryption.encryptString(title, kt, cid);
    const bodyCipher = await E2EEncryption.encryptString(body, kt, cid);

    // Encrypt sensitive metadata — keep coarse buckets unencrypted for sorting
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;
    const tagsCipher = tags?.length ? await E2EEncryption.encryptJson(tags, kt, cid) : null;

    const row = await Database.insertJournal({
      user_id: _userId,
      title_cipher: titleCipher,
      body_cipher: bodyCipher,
      mood,       // unencrypted coarse label for local calendar/filters
      mood_cipher: moodCipher,  // encrypted exact value for Supabase
      tags,
      tags_cipher: tagsCipher,  // encrypted exact value for Supabase
      is_private: isPrivate,
    });

    debouncedPush();
    return row;
  },

  async updateJournalEntry(id, { title, body, mood, tags, isPrivate }) {
    const updates = {};
    // Use device key for private entries, couple key for shared
    const kt = isPrivate ? deviceTier() : keyTier();
    const cid = kt === 'couple' ? _coupleId : null;

    if (title !== undefined) updates.title_cipher = await E2EEncryption.encryptString(title, kt, cid);
    if (body !== undefined) updates.body_cipher = await E2EEncryption.encryptString(body, kt, cid);
    if (mood !== undefined) updates.mood = mood;
    if (tags !== undefined) updates.tags = tags;
    if (isPrivate !== undefined) updates.is_private = isPrivate;

    const row = await Database.updateJournal(id, updates);
    debouncedPush();
    return row;
  },

  async deleteJournalEntry(id) {
    await Database.softDeleteJournal(id);
    debouncedPush();
  },

  async getJournalEntries({ limit = 50, offset = 0, mood } = {}) {
    const rows = await Database.getJournals(_userId, { limit, offset, mood });
    return Promise.all((rows || []).map(r => this._decryptJournal(r)));
  },

  async getJournalEntry(id) {
    const row = await Database.getJournalById(id);
    return row ? this._decryptJournal(row) : null;
  },

  async _decryptJournal(row) {
    if (!row) return null;
    // Detect which key tier the envelope was encrypted with
    const info = E2EEncryption.inspect(row.title_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        title: await E2EEncryption.decryptString(row.title_cipher, kt, cid),
        body: await E2EEncryption.decryptString(row.body_cipher, kt, cid),
        tags: row.tags ? JSON.parse(row.tags) : [],
        is_private: !!row.is_private,
      };
    } catch (err) {
      // Decryption failed — return with locked flag
      console.warn('[DataLayer] Journal decryption failed:', err?.message);
      return { ...row, title: null, body: null, tags: [], locked: true };
    }
  },

  // ─── Prompt Answers ───────────────────────────────────────────

  async savePromptAnswer({ promptId, answer, heatLevel = 1 }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const answerCipher = await E2EEncryption.encryptString(answer, kt, cid);
    const heatCipher = await E2EEncryption.encryptString(String(heatLevel), kt, cid);
    const dk = dateKey();

    const row = await Database.insertPromptAnswer({
      user_id: _userId,
      couple_id: _coupleId,
      prompt_id: promptId,
      date_key: dk,
      answer_cipher: answerCipher,
      heat_level: heatLevel,          // unencrypted for local sorting
      heat_level_cipher: heatCipher,  // encrypted for Supabase
    });

    debouncedPush();
    return row;
  },

  async revealPromptAnswer(id) {
    const row = await Database.updatePromptAnswer(id, {
      is_revealed: true,
      reveal_at: new Date().toISOString(),
    });
    debouncedPush();
    return row;
  },

  async getPromptAnswers({ dateKey: dk, promptId, limit = 100 } = {}) {
    const rows = await Database.getPromptAnswers(_userId, { dateKey: dk, promptId, limit });
    return Promise.all((rows || []).map(r => this._decryptPromptAnswer(r)));
  },

  async getPromptAnswerForToday(promptId) {
    const dk = dateKey();
    const row = await Database.getPromptAnswerByPromptAndDate(_userId, promptId, dk);
    return row ? this._decryptPromptAnswer(row) : null;
  },

  async _decryptPromptAnswer(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.answer_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        answer: await E2EEncryption.decryptString(row.answer_cipher, kt, cid),
        partnerAnswer: row.partner_answer_cipher
          ? await E2EEncryption.decryptString(row.partner_answer_cipher, kt, cid)
          : null,
        is_revealed: !!row.is_revealed,
      };
    } catch (err) {
      console.warn('[DataLayer] Prompt answer decryption failed:', err?.message);
      return { ...row, answer: null, partnerAnswer: null, locked: true };
    }
  },

  // ─── Memories ─────────────────────────────────────────────────

  async saveMemory({ content, type = 'moment', mood, isPrivate = false, mediaUri, mimeType, fileName }) {
    const kt = isPrivate ? deviceTier() : keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const bodyCipher = await E2EEncryption.encryptString(content, kt, cid);
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;

    let mediaRef = null;

    // Handle attachment if present
    if (mediaUri) {
      const att = await EncryptedAttachments.encryptAndStore({
        sourceUri: mediaUri,
        fileName: fileName || 'attachment',
        mimeType: mimeType || 'image/jpeg',
        userId: _userId,
        coupleId: _coupleId,
        parentType: 'memory',
        parentId: null, // will link after insert
        keyTier: kt,
      });
      mediaRef = att.id;
    }

    const row = await Database.insertMemory({
      user_id: _userId,
      couple_id: _coupleId,
      type,
      body_cipher: bodyCipher,
      media_ref: mediaRef,
      mood,
      mood_cipher: moodCipher,
      is_private: isPrivate,
    });

    debouncedPush();
    return row;
  },

  async getMemories({ type, limit = 100, offset = 0 } = {}) {
    const rows = await Database.getMemories(_userId, { type, limit, offset });
    return Promise.all((rows || []).map(r => this._decryptMemory(r)));
  },

  async _decryptMemory(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.body_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        content: await E2EEncryption.decryptString(row.body_cipher, kt, cid),
        is_private: !!row.is_private,
      };
    } catch (err) {
      console.warn('[DataLayer] Memory decryption failed:', err?.message);
      return { ...row, content: null, locked: true };
    }
  },

  async deleteMemory(id) {
    await Database.softDeleteMemory(id);
    debouncedPush();
  },

  // ─── Rituals ──────────────────────────────────────────────────

  async saveRitual({ flowId, responses, streakDay = 1 }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const bodyCipher = await E2EEncryption.encryptJson(responses, kt, cid);

    const row = await Database.insertRitual({
      user_id: _userId,
      couple_id: _coupleId,
      flow_id: flowId,
      body_cipher: bodyCipher,
      streak_day: streakDay,
    });

    debouncedPush();
    return row;
  },

  async getRituals({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getRituals(_userId, { limit, offset });
    return Promise.all((rows || []).map(async (row) => {
      const info = E2EEncryption.inspect(row.body_cipher);
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        return {
          ...row,
          responses: await E2EEncryption.decryptJson(row.body_cipher, kt, cid),
        };
      } catch {
        return { ...row, responses: null, locked: true };
      }
    }));
  },

  // ─── Check-ins ────────────────────────────────────────────────

  async saveCheckIn({ mood, intimacy, notes, touch }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const bodyCipher = await E2EEncryption.encryptJson(
      { mood, intimacy, notes, touch },
      kt, cid
    );
    const moodCipher = mood ? await E2EEncryption.encryptString(mood, kt, cid) : null;

    const row = await Database.insertCheckIn({
      user_id: _userId,
      couple_id: _coupleId,
      body_cipher: bodyCipher,
      mood,                // unencrypted label for local calendar display
      mood_cipher: moodCipher,  // encrypted for Supabase
      date_key: dateKey(),
    });

    debouncedPush();
    return row;
  },

  async getCheckIns({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getCheckIns(_userId, { limit, offset });
    return Promise.all((rows || []).map(async (row) => {
      const info = E2EEncryption.inspect(row.body_cipher);
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        const data = await E2EEncryption.decryptJson(row.body_cipher, kt, cid);
        return { ...row, ...(data || {}) };
      } catch {
        return { ...row, locked: true };
      }
    }));
  },

  async getCheckInForToday() {
    const row = await Database.getCheckInByDate(_userId, dateKey());
    if (!row) return null;
    const info = E2EEncryption.inspect(row.body_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      const data = await E2EEncryption.decryptJson(row.body_cipher, kt, cid);
      return { ...row, ...(data || {}) };
    } catch {
      return { ...row, locked: true };
    }
  },

  // ─── Vibes ────────────────────────────────────────────────────

  async saveVibe({ vibe, note }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    const noteCipher = note
      ? await E2EEncryption.encryptString(note, kt, cid)
      : null;

    const row = await Database.insertVibe({
      user_id: _userId,
      couple_id: _coupleId,
      vibe,
      note_cipher: noteCipher,
    });

    debouncedPush();
    return row;
  },

  async getVibes({ limit = 100 } = {}) {
    const rows = await Database.getVibes(_userId, { limit });
    return Promise.all((rows || []).map(async (row) => {
      const info = E2EEncryption.inspect(row.note_cipher);
      const kt = info?.keyTier || keyTier();
      const cid = kt === 'couple' ? _coupleId : null;
      try {
        return {
          ...row,
          note: row.note_cipher
            ? await E2EEncryption.decryptString(row.note_cipher, kt, cid)
            : null,
        };
      } catch {
        return { ...row, note: null, locked: true };
      }
    }));
  },

  async getLatestVibe() {
    const row = await Database.getLatestVibe(_userId);
    if (!row) return null;
    const info = E2EEncryption.inspect(row.note_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      return {
        ...row,
        note: row.note_cipher
          ? await E2EEncryption.decryptString(row.note_cipher, kt, cid)
          : null,
      };
    } catch {
      return { ...row, note: null, locked: true };
    }
  },

  // ─── Love Notes (E2EE + couple-synced) ─────────────────────────

  /**
   * Save a love note. Text and sender name are encrypted with the couple
   * key so only the two partners can read them. If a photo is attached,
   * it is encrypted via EncryptedAttachments (file bytes never leave the
   * device in plaintext).
   */
  async saveLoveNote({ text, stationeryId, senderName, imageUri }) {
    const kt = keyTier();
    const cid = kt === 'couple' ? _coupleId : null;

    // Pre-check: if couple tier is required, make sure the key exists
    if (kt === 'couple' && !_coupleKeyAvailable) {
      // Re-check in case it became available after init
      _coupleKeyAvailable = await E2EEncryption.hasCoupleKey(_coupleId);
      if (!_coupleKeyAvailable) {
        throw new Error(
          'COUPLE_KEY_MISSING: Your partner encryption key is not available yet. ' +
          'Please make sure both partners have completed pairing.'
        );
      }
    }

    const textCipher = await E2EEncryption.encryptString(text, kt, cid);
    const senderCipher = senderName
      ? await E2EEncryption.encryptString(senderName, kt, cid)
      : null;

    let mediaRef = null;
    if (imageUri) {
      const att = await EncryptedAttachments.encryptAndStore({
        sourceUri: imageUri,
        fileName: `love_note_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        userId: _userId,
        coupleId: _coupleId,
        parentType: 'love_note',
        parentId: null, // linked after insert
        keyTier: kt,
      });
      mediaRef = att.id;
    }

    const row = await Database.insertLoveNote({
      user_id: _userId,
      couple_id: _coupleId,
      text_cipher: textCipher,
      stationery_id: stationeryId || null,
      sender_name_cipher: senderCipher,
      media_ref: mediaRef,
      is_read: true, // sender has "read" their own note
    });

    // Link the attachment to this note
    if (mediaRef) {
      const db = await Database.init();
      await db.runAsync(
        `UPDATE attachments SET parent_id = ? WHERE id = ?`,
        [row.id, mediaRef]
      );
    }

    debouncedPush();
    return row;
  },

  /**
   * Get all love notes for the couple, decrypted.
   * Returns notes from BOTH partners (sorted newest-first).
   */
  async getLoveNotes({ limit = 100, offset = 0 } = {}) {
    const rows = await Database.getLoveNotes(_userId, _coupleId, { limit, offset });
    return Promise.all((rows || []).map(r => this._decryptLoveNote(r)));
  },

  /**
   * Get a single love note by ID, decrypted.
   */
  async getLoveNote(id) {
    const row = await Database.getLoveNoteById(id);
    return row ? this._decryptLoveNote(row) : null;
  },

  /**
   * Mark a love note as read (for the receiving partner).
   */
  async markLoveNoteRead(id) {
    const result = await Database.markLoveNoteRead(id);
    debouncedPush();
    return result;
  },

  /**
   * Soft-delete a love note.
   */
  async deleteLoveNote(id) {
    // Also clean up the encrypted attachment file
    const note = await Database.getLoveNoteById(id);
    if (note?.media_ref) {
      try {
        await EncryptedAttachments.deleteAttachment(note.media_ref);
      } catch { /* ok — attachment may already be gone */ }
    }
    await Database.softDeleteLoveNote(id);
    debouncedPush();
  },

  /**
   * Count unread love notes (notes sent by the partner).
   */
  async getUnreadLoveNoteCount() {
    return Database.getUnreadLoveNoteCount(_userId, _coupleId);
  },

  /**
   * Get a decrypted local URI for a love note's photo.
   * Returns null if the note has no attachment.
   */
  async getLoveNoteImageUri(mediaRef) {
    if (!mediaRef) return null;
    try {
      return await EncryptedAttachments.getDecryptedUri(
        mediaRef, keyTier(), _coupleId
      );
    } catch (err) {
      console.warn('[DataLayer] Love note image decryption failed:', err?.message);
      return null;
    }
  },

  /** @private */
  async _decryptLoveNote(row) {
    if (!row) return null;
    const info = E2EEncryption.inspect(row.text_cipher);
    const kt = info?.keyTier || keyTier();
    const cid = kt === 'couple' ? _coupleId : null;
    try {
      // Decrypt the photo to a temp URI if present
      let decryptedImageUri = null;
      if (row.media_ref) {
        try {
          decryptedImageUri = await EncryptedAttachments.getDecryptedUri(
            row.media_ref, kt, cid
          );
        } catch { /* photo may be still uploading/downloading */ }
      }

      return {
        id: row.id,
        text: await E2EEncryption.decryptString(row.text_cipher, kt, cid),
        stationeryId: row.stationery_id,
        senderName: row.sender_name_cipher
          ? await E2EEncryption.decryptString(row.sender_name_cipher, kt, cid)
          : null,
        imageUri: decryptedImageUri,
        mediaRef: row.media_ref,
        isRead: !!row.is_read,
        readAt: row.read_at,
        isOwn: row.user_id === _userId,
        userId: row.user_id,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
      };
    } catch (err) {
      console.warn('[DataLayer] Love note decryption failed:', err?.message);
      return {
        id: row.id,
        text: null,
        stationeryId: row.stationery_id,
        senderName: null,
        imageUri: null,
        isRead: !!row.is_read,
        isOwn: row.user_id === _userId,
        createdAt: new Date(row.created_at).getTime(),
        locked: true,
      };
    }
  },

  // ─── Attachments ──────────────────────────────────────────────

  async addAttachment(opts) {
    return EncryptedAttachments.encryptAndStore({
      ...opts,
      userId: _userId,
      coupleId: _coupleId,
      keyTier: keyTier(),
    });
  },

  async getDecryptedAttachment(attachmentId) {
    return EncryptedAttachments.getDecryptedUri(
      attachmentId, keyTier(), _coupleId
    );
  },

  async deleteAttachment(attachmentId) {
    return EncryptedAttachments.deleteAttachment(attachmentId);
  },

  // ─── Sync controls ───────────────────────────────────────────

  /** Trigger a full sync cycle. */
  async sync() {
    return SyncEngine.sync();
  },

  /** Subscribe to realtime changes from partner. Returns unsubscribe fn. */
  subscribeRealtime() {
    return SyncEngine.subscribeRealtime();
  },

  /** Listen to sync lifecycle events. Returns unsubscribe fn. */
  onSyncEvent(fn) {
    return SyncEngine.onSyncEvent(fn);
  },

  /** Purge soft-deleted rows older than N days. */
  async purgeOldData(daysOld = 30) {
    return Database.purgeDeleted(daysOld);
  },

  /** Clean up temp decrypted files. */
  async clearCache() {
    return EncryptedAttachments.clearDecryptedCache();
  },
};

export default DataLayer;
