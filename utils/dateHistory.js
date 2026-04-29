import { DataLayer } from '../services/localfirst';

export const DATE_COMPLETION_HIDE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

const ensureArray = (value) => (Array.isArray(value) ? value : []);

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

function memoryToSavedDateEntry(memory) {
  const payload = parseDateSavedPayload(memory?.content);
  if (!payload?.dateId) return null;

  return {
    id: payload.dateId,
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

export async function getDateSavedKeepsakes() {
  try {
    const memories = await DataLayer.getMemories({ type: 'date_saved', limit: 200 });
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

export async function saveDateSavedKeepsake(date) {
  if (!date?.id) {
    return { saved: [], entry: null, inserted: false };
  }

  const prev = await getDateSavedKeepsakes();
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
  });
  entry.memoryId = memory?.id || null;

  const next = [entry, ...prev];
  return { saved: next, entry, inserted: true };
}

export async function removeDateSavedKeepsake(dateId) {
  if (!dateId) {
    return { saved: [], removed: null };
  }

  const prev = await getDateSavedKeepsakes();
  const removed = prev.find((entry) => entry.id === dateId) || null;
  const next = prev.filter((entry) => entry.id !== dateId);

  if (removed?.memoryId) {
    try {
      await DataLayer.deleteMemory(removed.memoryId);
    } catch (error) {
      if (__DEV__) console.warn('[dateHistory] Failed to delete saved date memory:', error?.message);
    }
  }

  return { saved: next, removed };
}

export async function getDateHistory() {
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

    return history;
  } catch {
    return [];
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
  if (!date?.id) {
    return { history: [], entry: null, inserted: false };
  }

  const prev = await getDateHistory();
  const existing = prev.find((entry) => entry.id === date.id);
  if (existing) {
    const updatedExisting = { ...existing, ...overrides };
    const history = prev.map((entry) => entry.id === date.id ? updatedExisting : entry);
    if (existing.memoryId && typeof DataLayer.updateMemory === 'function') {
      await DataLayer.updateMemory(existing.memoryId, {
        content: JSON.stringify(buildDateHistoryPayload(date, {
          rating: updatedExisting.rating ?? null,
        })),
      });
    }
    return { history, entry: updatedExisting, inserted: false };
  }

  const payload = buildDateHistoryPayload(date, overrides);
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

  const memory = await DataLayer.saveMemory({
    type: 'date_tried',
    mood: date.style || 'date',
    content: JSON.stringify(payload),
    isPrivate: false,
  });
  entry.memoryId = memory?.id || null;

  const next = [entry, ...prev];
  return { history: next, entry, inserted: true };
}

export async function removeDateHistoryEntry(dateId) {
  if (!dateId) {
    return { history: [], removed: null };
  }

  const prev = await getDateHistory();
  const removed = prev.find((entry) => entry.id === dateId) || null;
  const next = prev.filter((entry) => entry.id !== dateId);

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
