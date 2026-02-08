/**
 * Database.js — Local-first SQLite layer for Between Us
 *
 * Every table carries `sync_status` + `updated_at` columns so the
 * SyncEngine can push deltas to Supabase without scanning full tables.
 *
 * Sensitive columns (body / answer / content) store **ciphertext only**.
 * Plain-text metadata (timestamps, type, mood-label) stays unencrypted
 * so we can sort, filter, and index locally without decrypting.
 *
 * Uses expo-sqlite (synchronous API, WAL mode) — zero network required.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'betweenus.db';
const DB_VERSION = 1;

let _db = null;

// ─── helpers ────────────────────────────────────────────────────────
const now = () => new Date().toISOString();

const makeId = (prefix = 'row') => {
  const entropy = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${entropy}`;
};

/** Whitelist of tables that sync helpers may reference via string interpolation. */
const VALID_SYNC_TABLES = new Set([
  'journal_entries', 'prompt_answers', 'memories',
  'rituals', 'check_ins', 'vibes', 'attachments',
]);

function assertValidTable(tableName) {
  if (!VALID_SYNC_TABLES.has(tableName)) {
    throw new Error(`[Database] Invalid table name for sync: "${tableName}"`);
  }
}

// ─── open / migrate ─────────────────────────────────────────────────

async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await migrate(_db);
  return _db;
}

async function migrate(db) {
  const { user_version } = await db.getFirstAsync('PRAGMA user_version;');

  if (user_version < 1) {
    await db.execAsync(`
      -- Journal entries (E2EE body)
      CREATE TABLE IF NOT EXISTS journal_entries (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        title_cipher    TEXT,          -- encrypted title
        body_cipher     TEXT,          -- encrypted rich content
        mood            TEXT,          -- unencrypted label for filters
        tags            TEXT,          -- JSON array, unencrypted
        is_private      INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,          -- soft-delete
        sync_status     TEXT DEFAULT 'pending',  -- pending | synced | conflict
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_journal_user   ON journal_entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_journal_sync   ON journal_entries(sync_status);
      CREATE INDEX IF NOT EXISTS idx_journal_date   ON journal_entries(created_at);

      -- Prompt answers (E2EE answer)
      CREATE TABLE IF NOT EXISTS prompt_answers (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        couple_id       TEXT,
        prompt_id       TEXT NOT NULL,
        date_key        TEXT NOT NULL,  -- YYYY-MM-DD
        answer_cipher   TEXT,           -- encrypted answer
        heat_level      INTEGER DEFAULT 1,
        is_revealed     INTEGER DEFAULT 0,
        reveal_at       TEXT,
        partner_answer_cipher TEXT,     -- encrypted partner answer (after reveal)
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_status     TEXT DEFAULT 'pending',
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_prompt_user   ON prompt_answers(user_id);
      CREATE INDEX IF NOT EXISTS idx_prompt_date   ON prompt_answers(date_key);
      CREATE INDEX IF NOT EXISTS idx_prompt_sync   ON prompt_answers(sync_status);

      -- Memories / moments (E2EE body)
      CREATE TABLE IF NOT EXISTS memories (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        couple_id       TEXT,
        type            TEXT DEFAULT 'moment',  -- moment | milestone | photo
        body_cipher     TEXT,            -- encrypted content
        media_ref       TEXT,            -- attachment key (encrypted file ref)
        mood            TEXT,
        is_private      INTEGER DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_status     TEXT DEFAULT 'pending',
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_mem_user  ON memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_mem_sync  ON memories(sync_status);
      CREATE INDEX IF NOT EXISTS idx_mem_date  ON memories(created_at);

      -- Rituals & streaks
      CREATE TABLE IF NOT EXISTS rituals (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        couple_id       TEXT,
        flow_id         TEXT,
        body_cipher     TEXT,            -- encrypted responses
        completed_at    TEXT NOT NULL,
        streak_day      INTEGER DEFAULT 1,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_status     TEXT DEFAULT 'pending',
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_rit_user  ON rituals(user_id);
      CREATE INDEX IF NOT EXISTS idx_rit_sync  ON rituals(sync_status);

      -- Check-ins
      CREATE TABLE IF NOT EXISTS check_ins (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        couple_id       TEXT,
        body_cipher     TEXT,            -- encrypted mood / intimacy / notes
        mood            TEXT,            -- unencrypted label for calendar view
        date_key        TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_status     TEXT DEFAULT 'pending',
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_ci_user  ON check_ins(user_id);
      CREATE INDEX IF NOT EXISTS idx_ci_sync  ON check_ins(sync_status);

      -- Vibes
      CREATE TABLE IF NOT EXISTS vibes (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        couple_id       TEXT,
        vibe            TEXT NOT NULL,
        note_cipher     TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_status     TEXT DEFAULT 'pending',
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_vibe_user ON vibes(user_id);
      CREATE INDEX IF NOT EXISTS idx_vibe_sync ON vibes(sync_status);

      -- Attachments (E2EE files)
      CREATE TABLE IF NOT EXISTS attachments (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        couple_id       TEXT,
        parent_type     TEXT,            -- journal | memory | ritual
        parent_id       TEXT,
        file_name_cipher TEXT,           -- encrypted original filename
        mime_type       TEXT,
        file_size       INTEGER,
        local_uri       TEXT,            -- local encrypted file path
        remote_key      TEXT,            -- Supabase storage key
        encryption_nonce TEXT,           -- nonce for file encryption
        upload_status   TEXT DEFAULT 'pending', -- pending | uploaded | failed
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        sync_status     TEXT DEFAULT 'pending',
        sync_version    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_att_parent ON attachments(parent_type, parent_id);
      CREATE INDEX IF NOT EXISTS idx_att_sync   ON attachments(sync_status);

      -- Sync metadata (tracks remote cursor per table)
      CREATE TABLE IF NOT EXISTS sync_meta (
        table_name      TEXT PRIMARY KEY,
        last_pulled_at  TEXT,
        last_pushed_at  TEXT,
        cursor          TEXT
      );

      PRAGMA user_version = 1;
    `);
  }

  // v2: Add sync_source column (prevents pull→push loops)
  if (user_version < 2) {
    const tables = [
      'journal_entries', 'prompt_answers', 'memories',
      'rituals', 'check_ins', 'vibes', 'attachments',
    ];
    for (const t of tables) {
      await db.execAsync(
        `ALTER TABLE ${t} ADD COLUMN sync_source TEXT DEFAULT 'local';`
      );
    }
    await db.execAsync('PRAGMA user_version = 2;');
  }

  // v3: Add encrypted metadata columns (mood_cipher, tags_cipher, heat_level_cipher)
  if (user_version < 3) {
    // journal_entries: mood + tags can be encrypted
    await db.execAsync(`ALTER TABLE journal_entries ADD COLUMN mood_cipher TEXT;`);
    await db.execAsync(`ALTER TABLE journal_entries ADD COLUMN tags_cipher TEXT;`);
    // prompt_answers: heat_level can be encrypted
    await db.execAsync(`ALTER TABLE prompt_answers ADD COLUMN heat_level_cipher TEXT;`);
    // memories: mood can be encrypted
    await db.execAsync(`ALTER TABLE memories ADD COLUMN mood_cipher TEXT;`);
    // check_ins: mood can be encrypted
    await db.execAsync(`ALTER TABLE check_ins ADD COLUMN mood_cipher TEXT;`);
    await db.execAsync('PRAGMA user_version = 3;');
  }

  // v4: Add missing updated_at / deleted_at to vibes table
  if (user_version < 4) {
    try {
      await db.execAsync(`ALTER TABLE vibes ADD COLUMN updated_at TEXT;`);
    } catch { /* column may already exist */ }
    try {
      await db.execAsync(`ALTER TABLE vibes ADD COLUMN deleted_at TEXT;`);
    } catch { /* column may already exist */ }
    // Backfill: set updated_at = created_at for existing rows
    await db.execAsync(`UPDATE vibes SET updated_at = created_at WHERE updated_at IS NULL;`);
    await db.execAsync('PRAGMA user_version = 4;');
  }

  // Future migrations: if (user_version < 5) { ... PRAGMA user_version = 5; }
}

// ─── Generic CRUD ───────────────────────────────────────────────────

const Database = {
  /** Resolve the singleton connection. Call once at app start. */
  async init() {
    return getDb();
  },

  /** Close connection (for testing / hot reload). */
  async close() {
    if (_db) {
      await _db.closeAsync();
      _db = null;
    }
  },

  // ─── Journal ────────────────────────────────────────────────────

  async insertJournal(entry) {
    const db = await getDb();
    const id = entry.id || makeId('jrn');
    const ts = now();
    await db.runAsync(
      `INSERT INTO journal_entries
         (id, user_id, title_cipher, body_cipher, mood, mood_cipher, tags, tags_cipher,
          is_private, created_at, updated_at, sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.title_cipher ?? null, entry.body_cipher ?? null,
       entry.mood ?? null, entry.mood_cipher ?? null,
       entry.tags ? JSON.stringify(entry.tags) : null, entry.tags_cipher ?? null,
       entry.is_private ? 1 : 0, entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async updateJournal(id, updates) {
    const db = await getDb();
    const ts = now();
    const fields = [];
    const params = [];

    for (const [k, v] of Object.entries(updates)) {
      if (['title_cipher', 'body_cipher', 'mood', 'mood_cipher', 'tags', 'tags_cipher', 'is_private'].includes(k)) {
        fields.push(`${k} = ?`);
        params.push(k === 'tags' ? JSON.stringify(v) : (k === 'is_private' ? (v ? 1 : 0) : v));
      }
    }
    if (!fields.length) return null;
    fields.push("updated_at = ?", "sync_status = 'pending'", "sync_version = sync_version + 1");
    params.push(ts, id);

    await db.runAsync(`UPDATE journal_entries SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);
    return { id, updated_at: ts };
  },

  async softDeleteJournal(id) {
    const db = await getDb();
    const ts = now();
    await db.runAsync(
      `UPDATE journal_entries SET deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [ts, ts, id]
    );
  },

  async getJournals(userId, { limit = 50, offset = 0, mood } = {}) {
    const db = await getDb();
    let sql = 'SELECT * FROM journal_entries WHERE user_id = ? AND deleted_at IS NULL';
    const params = [userId];
    if (mood) { sql += ' AND mood = ?'; params.push(mood); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.getAllAsync(sql, params);
  },

  async getJournalById(id) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM journal_entries WHERE id = ? AND deleted_at IS NULL', [id]);
  },

  // ─── Prompt Answers ─────────────────────────────────────────────

  async insertPromptAnswer(entry) {
    const db = await getDb();
    const id = entry.id || makeId('pa');
    const ts = now();
    await db.runAsync(
      `INSERT INTO prompt_answers
         (id, user_id, couple_id, prompt_id, date_key, answer_cipher,
          heat_level, is_revealed, reveal_at, created_at, updated_at,
          sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.couple_id ?? null, entry.prompt_id,
       entry.date_key, entry.answer_cipher ?? null,
       entry.heat_level ?? 1, entry.is_revealed ? 1 : 0,
       entry.reveal_at ?? null, entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async updatePromptAnswer(id, updates) {
    const db = await getDb();
    const ts = now();
    const fields = [];
    const params = [];

    for (const [k, v] of Object.entries(updates)) {
      if (['answer_cipher', 'partner_answer_cipher', 'is_revealed', 'reveal_at', 'heat_level'].includes(k)) {
        fields.push(`${k} = ?`);
        params.push(k === 'is_revealed' ? (v ? 1 : 0) : v);
      }
    }
    if (!fields.length) return null;
    fields.push("updated_at = ?", "sync_status = 'pending'", "sync_version = sync_version + 1");
    params.push(ts, id);

    await db.runAsync(`UPDATE prompt_answers SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);
    return { id, updated_at: ts };
  },

  async getPromptAnswers(userId, { dateKey, promptId, limit = 100 } = {}) {
    const db = await getDb();
    let sql = 'SELECT * FROM prompt_answers WHERE user_id = ? AND deleted_at IS NULL';
    const params = [userId];
    if (dateKey) { sql += ' AND date_key = ?'; params.push(dateKey); }
    if (promptId) { sql += ' AND prompt_id = ?'; params.push(promptId); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return db.getAllAsync(sql, params);
  },

  async getPromptAnswerByPromptAndDate(userId, promptId, dateKey) {
    const db = await getDb();
    return db.getFirstAsync(
      'SELECT * FROM prompt_answers WHERE user_id = ? AND prompt_id = ? AND date_key = ? AND deleted_at IS NULL',
      [userId, promptId, dateKey]
    );
  },

  async softDeletePromptAnswer(id) {
    const db = await getDb();
    const ts = now();
    await db.runAsync(
      `UPDATE prompt_answers SET deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [ts, ts, id]
    );
  },

  // ─── Memories ───────────────────────────────────────────────────

  async insertMemory(entry) {
    const db = await getDb();
    const id = entry.id || makeId('mem');
    const ts = now();
    await db.runAsync(
      `INSERT INTO memories
         (id, user_id, couple_id, type, body_cipher, media_ref,
          mood, is_private, created_at, updated_at, sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.couple_id ?? null, entry.type ?? 'moment',
       entry.body_cipher ?? null, entry.media_ref ?? null,
       entry.mood ?? null, entry.is_private ? 1 : 0,
       entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async updateMemory(id, updates) {
    const db = await getDb();
    const ts = now();
    const fields = [];
    const params = [];

    for (const [k, v] of Object.entries(updates)) {
      if (['body_cipher', 'media_ref', 'mood', 'type', 'is_private'].includes(k)) {
        fields.push(`${k} = ?`);
        params.push(k === 'is_private' ? (v ? 1 : 0) : v);
      }
    }
    if (!fields.length) return null;
    fields.push("updated_at = ?", "sync_status = 'pending'", "sync_version = sync_version + 1");
    params.push(ts, id);

    await db.runAsync(`UPDATE memories SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);
    return { id, updated_at: ts };
  },

  async softDeleteMemory(id) {
    const db = await getDb();
    const ts = now();
    await db.runAsync(
      `UPDATE memories SET deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [ts, ts, id]
    );
  },

  async getMemories(userId, { type, limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    let sql = 'SELECT * FROM memories WHERE user_id = ? AND deleted_at IS NULL';
    const params = [userId];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.getAllAsync(sql, params);
  },

  async getMemoryById(id) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM memories WHERE id = ? AND deleted_at IS NULL', [id]);
  },

  // ─── Rituals ────────────────────────────────────────────────────

  async insertRitual(entry) {
    const db = await getDb();
    const id = entry.id || makeId('rit');
    const ts = now();
    await db.runAsync(
      `INSERT INTO rituals
         (id, user_id, couple_id, flow_id, body_cipher, completed_at,
          streak_day, created_at, updated_at, sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.couple_id ?? null, entry.flow_id ?? null,
       entry.body_cipher ?? null, entry.completed_at ?? ts,
       entry.streak_day ?? 1, entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async getRituals(userId, { limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    return db.getAllAsync(
      'SELECT * FROM rituals WHERE user_id = ? AND deleted_at IS NULL ORDER BY completed_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
  },

  async softDeleteRitual(id) {
    const db = await getDb();
    const ts = now();
    await db.runAsync(
      `UPDATE rituals SET deleted_at = ?, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [ts, ts, id]
    );
  },

  // ─── Check-ins ──────────────────────────────────────────────────

  async insertCheckIn(entry) {
    const db = await getDb();
    const id = entry.id || makeId('ci');
    const ts = now();
    await db.runAsync(
      `INSERT INTO check_ins
         (id, user_id, couple_id, body_cipher, mood, date_key,
          created_at, updated_at, sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.couple_id ?? null,
       entry.body_cipher ?? null, entry.mood ?? null,
       entry.date_key, entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async getCheckIns(userId, { limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    return db.getAllAsync(
      'SELECT * FROM check_ins WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
  },

  async getCheckInByDate(userId, dateKey) {
    const db = await getDb();
    return db.getFirstAsync(
      'SELECT * FROM check_ins WHERE user_id = ? AND date_key = ? AND deleted_at IS NULL',
      [userId, dateKey]
    );
  },

  // ─── Vibes ──────────────────────────────────────────────────────

  async insertVibe(entry) {
    const db = await getDb();
    const id = entry.id || makeId('vib');
    const ts = now();
    await db.runAsync(
      `INSERT INTO vibes (id, user_id, couple_id, vibe, note_cipher, created_at, updated_at, sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.couple_id ?? null, entry.vibe,
       entry.note_cipher ?? null, entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async getVibes(userId, { limit = 100 } = {}) {
    const db = await getDb();
    return db.getAllAsync(
      'SELECT * FROM vibes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  },

  async getLatestVibe(userId) {
    const db = await getDb();
    return db.getFirstAsync(
      'SELECT * FROM vibes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  },

  // ─── Attachments ────────────────────────────────────────────────

  async insertAttachment(entry) {
    const db = await getDb();
    const id = entry.id || makeId('att');
    const ts = now();
    await db.runAsync(
      `INSERT INTO attachments
         (id, user_id, couple_id, parent_type, parent_id,
          file_name_cipher, mime_type, file_size, local_uri,
          remote_key, encryption_nonce, upload_status,
          created_at, updated_at, sync_status, sync_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'pending', 0)`,
      [id, entry.user_id, entry.couple_id ?? null,
       entry.parent_type ?? null, entry.parent_id ?? null,
       entry.file_name_cipher ?? null, entry.mime_type ?? null,
       entry.file_size ?? null, entry.local_uri ?? null,
       entry.remote_key ?? null, entry.encryption_nonce ?? null,
       entry.created_at ?? ts, ts]
    );
    return { id, created_at: entry.created_at ?? ts, updated_at: ts };
  },

  async markAttachmentUploaded(id, remoteKey) {
    const db = await getDb();
    const ts = now();
    await db.runAsync(
      `UPDATE attachments SET remote_key = ?, upload_status = 'uploaded', updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1 WHERE id = ?`,
      [remoteKey, ts, id]
    );
  },

  async getAttachments(parentType, parentId) {
    const db = await getDb();
    return db.getAllAsync(
      'SELECT * FROM attachments WHERE parent_type = ? AND parent_id = ? AND deleted_at IS NULL ORDER BY created_at',
      [parentType, parentId]
    );
  },

  async getPendingAttachmentUploads() {
    const db = await getDb();
    return db.getAllAsync(
      "SELECT * FROM attachments WHERE upload_status = 'pending' AND deleted_at IS NULL ORDER BY created_at LIMIT 20"
    );
  },

  // ─── Sync helpers ───────────────────────────────────────────────

  /**
   * Return rows that need to be pushed upstream.
   * Excludes rows from remote origin (prevents pull→push loops).
   */
  async getPendingSync(tableName, limit = 50) {
    assertValidTable(tableName);
    const db = await getDb();
    return db.getAllAsync(
      `SELECT * FROM ${tableName}
       WHERE sync_status = 'pending'
         AND (sync_source IS NULL OR sync_source != 'remote')
       ORDER BY updated_at LIMIT ?`,
      [limit]
    );
  },

  /** After a successful push, mark rows as synced. */
  async markSynced(tableName, ids) {
    if (!ids.length) return;
    assertValidTable(tableName);
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE ${tableName} SET sync_status = 'synced' WHERE id IN (${placeholders})`,
      ids
    );
  },

  /**
   * After pulling from remote, upsert rows (last-write-wins by updated_at).
   * Source-tagged as 'remote' so these rows are NOT re-pushed.
   */
  async upsertFromRemote(tableName, row) {
    assertValidTable(tableName);
    const db = await getDb();
    // Check if the row already exists and compare versions
    const existing = await db.getFirstAsync(
      `SELECT id, sync_version, updated_at FROM ${tableName} WHERE id = ?`,
      [row.id]
    );

    if (!existing) {
      // New row from remote — insert with synced status + remote source
      const cols = Object.keys(row).filter(k => k !== 'sync_status' && k !== 'sync_source');
      const placeholders = cols.map(() => '?').join(',');
      const vals = cols.map(k => row[k]);
      cols.push('sync_status', 'sync_source');
      vals.push('synced', 'remote');
      await db.runAsync(
        `INSERT OR REPLACE INTO ${tableName} (${cols.join(',')}) VALUES (${placeholders},?,?)`,
        vals
      );
      return 'inserted';
    }

    // Existing row — last-write-wins (only overwrite if remote is newer)
    if (row.updated_at > existing.updated_at) {
      const cols = Object.keys(row).filter(k => k !== 'id' && k !== 'sync_status' && k !== 'sync_source');
      const sets = cols.map(k => `${k} = ?`).join(', ');
      const vals = cols.map(k => row[k]);
      vals.push(row.id);
      await db.runAsync(
        `UPDATE ${tableName} SET ${sets}, sync_status = 'synced', sync_source = 'remote' WHERE id = ?`,
        vals
      );
      return 'updated';
    }

    return 'skipped';
  },

  /**
   * Batch upsert from remote inside a single SQLite transaction.
   * Prevents half-applied state if the app crashes mid-pull.
   */
  async batchUpsertFromRemote(tableName, rows) {
    if (!rows.length) return { inserted: 0, updated: 0, skipped: 0 };
    assertValidTable(tableName);
    const db = await getDb();
    const results = { inserted: 0, updated: 0, skipped: 0 };

    await db.execAsync('BEGIN TRANSACTION');
    try {
      for (const row of rows) {
        const result = await this.upsertFromRemote(tableName, row);
        results[result]++;
      }
      await db.execAsync('COMMIT');
    } catch (err) {
      await db.execAsync('ROLLBACK');
      throw err;
    }
    return results;
  },

  // ─── Sync metadata ─────────────────────────────────────────────

  async getSyncMeta(tableName) {
    const db = await getDb();
    return db.getFirstAsync('SELECT * FROM sync_meta WHERE table_name = ?', [tableName]);
  },

  async setSyncMeta(tableName, updates) {
    const db = await getDb();
    const existing = await db.getFirstAsync('SELECT * FROM sync_meta WHERE table_name = ?', [tableName]);
    if (existing) {
      const fields = [];
      const params = [];
      for (const [k, v] of Object.entries(updates)) {
        fields.push(`${k} = ?`);
        params.push(v);
      }
      params.push(tableName);
      await db.runAsync(`UPDATE sync_meta SET ${fields.join(', ')} WHERE table_name = ?`, params);
    } else {
      await db.runAsync(
        'INSERT INTO sync_meta (table_name, last_pulled_at, last_pushed_at, cursor) VALUES (?, ?, ?, ?)',
        [tableName, updates.last_pulled_at ?? null, updates.last_pushed_at ?? null, updates.cursor ?? null]
      );
    }
  },

  // ─── Purge ──────────────────────────────────────────────────────

  /** Permanently delete soft-deleted rows older than N days. */
  async purgeDeleted(daysOld = 30) {
    const db = await getDb();
    const cutoff = new Date(Date.now() - daysOld * 86400000).toISOString();
    const tables = ['journal_entries', 'prompt_answers', 'memories', 'rituals', 'check_ins', 'attachments'];
    let total = 0;
    for (const t of tables) {
      const result = await db.runAsync(
        `DELETE FROM ${t} WHERE deleted_at IS NOT NULL AND deleted_at < ? AND sync_status = 'synced'`,
        [cutoff]
      );
      total += result.changes;
    }
    return total;
  },

  // ─── Wipe (sign-out / delete account) ───────────────────────────

  async wipeAll() {
    const db = await getDb();
    const tables = ['journal_entries', 'prompt_answers', 'memories', 'rituals', 'check_ins', 'vibes', 'attachments', 'sync_meta'];
    for (const t of tables) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
  },
};

export default Database;
