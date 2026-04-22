const fs = require('fs');

const path = 'services/sync/SyncEngine.js';
let content = fs.readFileSync(path, 'utf-8');

const injection = `
  /**
   * Pushes a single record synchronously to Supabase (Server-First).
   * If it succeeds, the record is fully ACK'd by the server.
   * Throws if the server rejects it.
   */
  async pushSingleRecord(tableName, row) {
    if (!canSync()) throw new Error('Sync not configured');
    const remote = toRemoteRow(tableName, row);

    // Tombstone: if soft-deleted locally, mark as deleted on remote
    if (row.deleted_at) {
      remote.is_deleted = true;
      remote.deleted_at = row.deleted_at;
    }

    const { data, error } = await supabase
      .from(TABLES.COUPLE_DATA)
      .upsert(remote, { onConflict: 'couple_id,key' })
      .select()
      .single();

    if (error) throw error;
    
    const local = fromRemoteRow(tableName, data);
    if (!local) throw new Error('Failed to parse remote row');
    
    // Directly hydrate the SQLite cache to avoid redundant pull loops
    await Database.upsertFromRemote(tableName, local);
    return local;
  },

  /**
   * Push only (useful right after a write).
`;

content = content.replace('  /**\n   * Push only (useful right after a write).', injection.trim() + '\n');
fs.writeFileSync(path, content);
console.log('updated');
