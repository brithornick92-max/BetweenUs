import { DataLayer } from '../services/localfirst';
import { storage } from './storage';

export const DATE_HISTORY_KEY = '@betweenus:cache:dateHistory';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

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

function parseDateHistoryPayload(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.kind === 'date_history' ? parsed : null;
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

async function setDateHistoryCache(history) {
  await storage.set(DATE_HISTORY_KEY, ensureArray(history));
}

export async function getDateHistory() {
  try {
    const memories = await DataLayer.getMemories({ type: 'date_tried', limit: 200 });
    const history = ensureArray(memories)
      .map(memoryToHistoryEntry)
      .filter(Boolean)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    await setDateHistoryCache(history);
    return history;
  } catch {
    return ensureArray(await storage.get(DATE_HISTORY_KEY, []));
  }
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
    await setDateHistoryCache(history);
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
  await setDateHistoryCache(next);
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

  await setDateHistoryCache(next);
  return { history: next, removed };
}

export async function rateDateHistoryEntry(date, rating) {
  if (!date?.id) return { history: [], entry: null };
  const prev = await getDateHistory();
  const existing = prev.find((entry) => entry.id === date.id);
  const nextRating = existing?.rating === rating ? null : rating;
  return saveDateHistoryEntry(date, { rating: nextRating });
}
