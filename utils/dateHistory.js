import { DataLayer } from '../services/localfirst';

export const DATE_HISTORY_KEY = '@betweenus:dateGoneOn';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

function buildDateMemoryContent(date) {
  return `Date tried: ${date?.title || 'Untitled date'}`;
}

export async function getDateHistory(storageApi) {
  const raw = await storageApi.getItem(DATE_HISTORY_KEY);
  return ensureArray(raw ? JSON.parse(raw) : []);
}

async function setDateHistory(storageApi, history) {
  await storageApi.setItem(DATE_HISTORY_KEY, JSON.stringify(ensureArray(history)));
}

export async function saveDateHistoryEntry(date, storageApi, overrides = {}) {
  if (!date?.id || !storageApi?.getItem || !storageApi?.setItem) {
    return { history: [], entry: null, inserted: false };
  }

  const prev = await getDateHistory(storageApi);
  const existing = prev.find((entry) => entry.id === date.id);
  if (existing) {
    const updatedExisting = { ...existing, ...overrides };
    const history = prev.map((entry) => entry.id === date.id ? updatedExisting : entry);
    await setDateHistory(storageApi, history);
    return { history, entry: updatedExisting, inserted: false };
  }

  const entry = {
    id: date.id,
    title: date.title,
    heat: date.heat ?? null,
    load: date.load ?? null,
    style: date.style ?? null,
    minutes: date.minutes ?? null,
    location: date.location ?? null,
    addedAt: Date.now(),
    rating: null,
    memoryId: null,
    ...overrides,
  };

  try {
    const memory = await DataLayer.saveMemory({
      type: 'date_tried',
      mood: date.style || 'date',
      content: buildDateMemoryContent(date),
      isPrivate: false,
    });
    entry.memoryId = memory?.id || null;
  } catch (error) {
    if (__DEV__) console.warn('[dateHistory] Failed to save date memory:', error?.message);
  }

  const next = [entry, ...prev];
  await setDateHistory(storageApi, next);
  return { history: next, entry, inserted: true };
}

export async function removeDateHistoryEntry(dateId, storageApi) {
  if (!dateId || !storageApi?.getItem || !storageApi?.setItem) {
    return { history: [], removed: null };
  }

  const prev = await getDateHistory(storageApi);
  const removed = prev.find((entry) => entry.id === dateId) || null;
  const next = prev.filter((entry) => entry.id !== dateId);

  if (removed?.memoryId) {
    try {
      await DataLayer.deleteMemory(removed.memoryId);
    } catch (error) {
      if (__DEV__) console.warn('[dateHistory] Failed to delete date memory:', error?.message);
    }
  }

  await setDateHistory(storageApi, next);
  return { history: next, removed };
}

export async function rateDateHistoryEntry(date, rating, storageApi) {
  if (!date?.id) return { history: [], entry: null };
  const prev = await getDateHistory(storageApi);
  const existing = prev.find((entry) => entry.id === date.id);
  const nextRating = existing?.rating === rating ? null : rating;
  return saveDateHistoryEntry(date, storageApi, { rating: nextRating });
}
