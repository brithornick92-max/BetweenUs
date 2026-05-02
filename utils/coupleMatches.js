import { DataLayer } from '../services/localfirst';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

function parsePayload(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function dedupeRows(rows) {
  const seen = new Set();
  return ensureArray(rows).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function getRows(type) {
  const loader = typeof DataLayer.getSharedMemories === 'function'
    ? DataLayer.getSharedMemories.bind(DataLayer)
    : DataLayer.getMemories.bind(DataLayer);

  return dedupeRows(await loader({ type, limit: 500 }).catch(() => []));
}

function buildMatchMap(rows, {
  currentUserId = typeof DataLayer.getCurrentUserId === 'function' ? DataLayer.getCurrentUserId() : null,
  sourceKey,
}) {
  const state = {};

  for (const row of dedupeRows(rows)) {
    const payload = parsePayload(row?.content);
    const sourceId = payload?.[sourceKey];
    if (!sourceId) continue;

    const key = String(sourceId);
    const ownerId = row?.user_id || null;
    const entry = {
      sourceId: key,
      memoryId: row.id,
      userId: ownerId,
      createdAt: row.created_at || null,
      title: payload.title || null,
    };

    if (!state[key]) {
      state[key] = {
        mine: null,
        partner: null,
        all: [],
        isMatch: false,
      };
    }

    state[key].all.push(entry);

    if (currentUserId && ownerId === currentUserId) {
      if (!state[key].mine || new Date(entry.createdAt || 0) > new Date(state[key].mine.createdAt || 0)) {
        state[key].mine = entry;
      }
    } else {
      if (!state[key].partner || new Date(entry.createdAt || 0) > new Date(state[key].partner.createdAt || 0)) {
        state[key].partner = entry;
      }
    }
  }

  Object.values(state).forEach((entry) => {
    entry.isMatch = !!entry.mine && !!entry.partner;
  });

  return state;
}

export async function getDateMatchState(currentUserId) {
  const rows = await getRows('date_saved');
  return buildMatchMap(rows, { currentUserId, sourceKey: 'dateId' });
}

export async function getIntimacyMatchState(currentUserId) {
  const rows = await getRows('intimacy_favorite');
  return buildMatchMap(rows, { currentUserId, sourceKey: 'positionId' });
}

export default {
  getDateMatchState,
  getIntimacyMatchState,
};
