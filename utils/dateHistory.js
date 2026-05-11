import { DataLayer } from '../services/localfirst';
import { removeRestoredDeckItem } from './contentDeckRestores';
import { storage, STORAGE_KEYS } from './storage';

export const DATE_COMPLETION_HIDE_DAYS = 36500;

const DAY_MS = 24 * 60 * 60 * 1000;

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const ensureObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

function dedupeMemories(rows) {
  const seen = new Set();
  return ensureArray(rows).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function buildDateHistoryPayload(date, overrides = {}) {
  return {
    kind: 'date_history',
    dateId: date?.id,
    title: date?.title || 'Untitled date',
    heat: date?.heat ?? null,
    load: date?.load ?? null,
    style: date?.style ?? null,
    minutes: date?.minutes ?? null,
    location: date?.location ?? null,
    rating: null,
    ...overrides,
  };
}

function buildDateSavedPayload(date) {
  return {
    kind: 'date_saved',
    dateId: date?.id,
    title: date?.title || 'Untitled date',
    heat: date?.heat ?? null,
    load: date?.load ?? null,
    style: date?.style ?? null,
    minutes: date?.minutes ?? null,
    location: date?.location ?? null,
  };
}

function parseDateHistoryPayload(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.kind === 'date_history' ? parsed : null;
  } catch {
    return null;
  }
}

function parseDateSavedPayload(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.kind === 'date_saved' ? parsed : null;
  } catch {
    return null;
  }
}

function memoryToHistoryEntry(memory) {
  const payload = parseDateHistoryPayload(memory?.content);
  if (!payload?.dateId) return null;
  return {
    id: payload.dateId,
    title: payload.title || 'Untitled date',
    heat: payload.heat ?? null,
    load: payload.load ?? null,
    style: payload.style ?? null,
    minutes: payload.minutes ?? null,
    location: payload.location ?? null,
    addedAt: memory?.created_at ? new Date(memory.created_at).getTime() : Date.now(),
    rating: payload.rating ?? null,
    memoryId: memory?.id || null,
  };
}

function entryTime(entry) {
  return Number(entry?.addedAt || 0);
}

async function getLocalDateHistoryState() {
  const stored = ensureObject(await storage.get(STORAGE_KEYS.DATE_TRIED_FALLBACK, {}));
  return {
    entries: ensureObject(stored.entries),
    deleted: ensureObject(stored.deleted),
  };
}

async function setLocalDateHistoryState(state) {
  await storage.set(STORAGE_KEYS.DATE_TRIED_FALLBACK, {
    entries: ensureObject(state?.entries),
    deleted: ensureObject(state?.deleted),
  });
}

function mergeDateHistory(remoteHistory = [], localState = {}) {
  const localEntries = ensureObject(localState.entries);
  const deleted = ensureObject(localState.deleted);
  const byId = new Map();

  ensureArray(remoteHistory).forEach((entry) => {
    if (!entry?.id) return;
    const deletedAt = Number(deleted[entry.id] || 0);
    if (deletedAt && entryTime(entry) <= deletedAt) return;
    byId.set(entry.id, entry);
  });

  Object.values(localEntries).forEach((entry) => {
    if (!entry?.id) return;
    const deletedAt = Number(deleted[entry.id] || 0);
    if (deletedAt && entryTime(entry) <= deletedAt) return;

    const existing = byId.get(entry.id);
    if (!existing || entryTime(entry) >= entryTime(existing)) {
      byId.set(entry.id, {
        ...existing,
        ...entry,
        memoryId: entry.memoryId || existing?.memoryId || null,
      });
    }
  });

  return Array.from(byId.values())
    .sort((a, b) => entryTime(b) - entryTime(a));
}

async function upsertLocalDateHistoryEntry(entry) {
  if (!entry?.id) return;
  const local = await getLocalDateHistoryState();
  local.entries[entry.id] = entry;
  delete local.deleted[entry.id];
  await setLocalDateHistoryState(local);
}

async function removeLocalDateHistoryEntry(dateId) {
  if (!dateId) return;
  const local = await getLocalDateHistoryState();
  delete local.entries[dateId];
  local.deleted[dateId] = Date.now();
  await setLocalDateHistoryState(local);
}

function memoryToSavedDateEntry(memory) {
  const payload = parseDateSavedPayload(memory?.content);
  if (!payload?.dateId) return null;

  return {
    id: payload.dateId,
    userId: memory?.user_id || null,
    title: payload.title || 'Untitled date',
    heat: payload.heat ?? null,
    load: payload.load ?? null,
    style: payload.style ?? null,
    minutes: payload.minutes ?? null,
    location: payload.location ?? null,
    savedAt: memory?.created_at || new Date().toISOString(),
    memoryId: memory?.id || null,
  };
}

export async function getDateSavedKeepsakes({ ownedOnly = false } = {}) {
  try {
    const memories = await DataLayer.getMemories({ type: 'date_saved', limit: 200, ownedOnly });
    const savedByDateId = dedupeMemories(memories)
      .map(memoryToSavedDateEntry)
      .filter(Boolean)
      .reduce((acc, entry) => {
        const existing = acc.get(entry.id);
        if (!existing || new Date(entry.savedAt).getTime() > new Date(existing.savedAt).getTime()) {
          acc.set(entry.id, entry);
        }
        return acc;
      }, new Map());

    const saved = Array.from(savedByDateId.values())
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    return saved;
  } catch {
    return [];
  }
}

export async function saveDateSavedKeepsake(date, { notifyPartner = false } = {}) {
  if (!date?.id) {
    return { saved: [], entry: null, inserted: false };
  }

  const prev = await getDateSavedKeepsakes({ ownedOnly: true });
  const existing = prev.find((entry) => entry.id === date.id);
  if (existing) {
    return { saved: prev, entry: existing, inserted: false };
  }

  const payload = buildDateSavedPayload(date);
  const entry = {
    id: payload.dateId,
    title: payload.title,
    heat: payload.heat,
    load: payload.load,
    style: payload.style,
    minutes: payload.minutes,
    location: payload.location,
    savedAt: new Date().toISOString(),
    memoryId: null,
  };

  const memory = await DataLayer.saveMemory({
    type: 'date_saved',
    mood: date.style || 'date',
    content: JSON.stringify(payload),
    isPrivate: false,
    notifyPartner,
  });
  entry.memoryId = memory?.id || null;

  const next = [entry, ...prev];
  return { saved: next, entry, inserted: true };
}

export async function removeDateSavedKeepsake(dateId) {
  if (!dateId) {
    return { saved: [], removed: null };
  }

  const prev = await getDateSavedKeepsakes({ ownedOnly: true });
  const removed = prev.find((entry) => entry.id === dateId) || null;
  const next = prev.filter((entry) => entry.id !== dateId);

  if (removed?.memoryId) {
    try {
      await DataLayer.deleteMemory(removed.memoryId);
    } catch (error) {
      if (__DEV__) console.warn('[dateHistory] Failed to delete saved date memory:', error?.message);
      throw error;
    }
  }

  return { saved: next, removed };
}

export async function getDateHistory() {
  const local = await getLocalDateHistoryState();

  try {
    const [personalMemories, sharedMemories] = await Promise.all([
      DataLayer.getMemories({ type: 'date_tried', limit: 200 }),
      typeof DataLayer.getSharedMemories === 'function'
        ? DataLayer.getSharedMemories({ type: 'date_tried', limit: 200 })
        : Promise.resolve([]),
    ]);

    const historyByDateId = dedupeMemories([
      ...ensureArray(sharedMemories),
      ...ensureArray(personalMemories),
    ])
      .map(memoryToHistoryEntry)
      .filter(Boolean)
      .reduce((acc, entry) => {
        const existing = acc.get(entry.id);
        if (!existing || (entry.addedAt || 0) > (existing.addedAt || 0)) {
          acc.set(entry.id, entry);
        }
        return acc;
      }, new Map());

    const history = Array.from(historyByDateId.values())
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    return mergeDateHistory(history, local);
  } catch {
    return mergeDateHistory([], local);
  }
}

export function getRecentlyCompletedDateIds(history = [], now = Date.now()) {
  const cutoff = now - (DATE_COMPLETION_HIDE_DAYS * DAY_MS);

  return new Set(
    ensureArray(history)
      .filter((entry) => Number(entry?.addedAt) >= cutoff)
      .map((entry) => entry.id)
      .filter(Boolean)
  );
}

export async function saveDateHistoryEntry(date, overrides = {}) {
  const {
    notifyPartner = false,
    ...payloadOverrides
  } = overrides || {};

  if (!date?.id) {
    return { history: [], entry: null, inserted: false };
  }

  await removeRestoredDeckItem('dates', date.id).catch(() => {});

  const prev = await getDateHistory();
  const existing = prev.find((entry) => entry.id === date.id);
  if (existing) {
    const updatedExisting = { ...existing, ...payloadOverrides };
    await upsertLocalDateHistoryEntry(updatedExisting);

    let entry = updatedExisting;
    try {
      if (existing.memoryId && typeof DataLayer.updateMemory === 'function') {
        await DataLayer.updateMemory(existing.memoryId, {
          content: JSON.stringify(buildDateHistoryPayload(date, {
            rating: updatedExisting.rating ?? null,
          })),
        });
      } else {
        const memory = await DataLayer.saveMemory({
          type: 'date_tried',
          mood: date.style || 'date',
          content: JSON.stringify(buildDateHistoryPayload(date, {
            rating: updatedExisting.rating ?? null,
          })),
          isPrivate: false,
          notifyPartner,
        });
        entry = { ...updatedExisting, memoryId: memory?.id || null };
        await upsertLocalDateHistoryEntry(entry);
      }
    } catch (error) {
      if (__DEV__) console.warn('[dateHistory] Failed to sync date history update:', error?.message);
    }

    const history = mergeDateHistory(prev.map((item) => item.id === date.id ? entry : item), await getLocalDateHistoryState());
    return { history, entry, inserted: false };
  }

  const payload = buildDateHistoryPayload(date, payloadOverrides);
  const entry = {
    id: payload.dateId,
    title: payload.title,
    heat: payload.heat,
    load: payload.load,
    style: payload.style,
    minutes: payload.minutes,
    location: payload.location,
    addedAt: Date.now(),
    rating: payload.rating ?? null,
    memoryId: null,
  };

  await upsertLocalDateHistoryEntry(entry);

  try {
    const memory = await DataLayer.saveMemory({
      type: 'date_tried',
      mood: date.style || 'date',
      content: JSON.stringify(payload),
      isPrivate: false,
      notifyPartner,
    });
    entry.memoryId = memory?.id || null;
    await upsertLocalDateHistoryEntry(entry);
  } catch (error) {
    if (__DEV__) console.warn('[dateHistory] Failed to sync date history entry:', error?.message);
  }

  const next = mergeDateHistory([entry, ...prev], await getLocalDateHistoryState());
  return { history: next, entry, inserted: true };
}

export async function removeDateHistoryEntry(dateId) {
  if (!dateId) {
    return { history: [], removed: null };
  }

  const prev = await getDateHistory();
  const removed = prev.find((entry) => entry.id === dateId) || null;
  const next = prev.filter((entry) => entry.id !== dateId);

  await removeLocalDateHistoryEntry(dateId);

  if (removed?.memoryId) {
    try {
      await DataLayer.deleteMemory(removed.memoryId);
    } catch (error) {
      if (__DEV__) console.warn('[dateHistory] Failed to delete date memory:', error?.message);
    }
  }

  return { history: next, removed };
}

export async function rateDateHistoryEntry(date, rating) {
  if (!date?.id) return { history: [], entry: null };
  const prev = await getDateHistory();
  const existing = prev.find((entry) => entry.id === date.id);
  const nextRating = existing?.rating === rating ? null : rating;
  return saveDateHistoryEntry(date, { rating: nextRating });
}
