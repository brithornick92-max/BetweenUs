import { DataLayer } from '../services/localfirst';
import { storage } from './storage';

export const INTIMACY_FAVORITES_KEY = '@betweenus:cache:intimacyFavorites';
export const INTIMACY_TRIED_KEY = '@betweenus:cache:intimacyPositionsTried';

const ensureObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

function buildTriedMemoryPayload(position, overrides = {}) {
  return {
    kind: 'intimacy_tried',
    positionId: position?.id,
    title: position?.title || 'Untitled position',
    commonName: position?.commonName || null,
    mood: position?.mood || null,
    heat: position?.heat ?? null,
    rating: null,
    ...overrides,
  };
}

function parseTriedMemoryPayload(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.kind === 'intimacy_tried' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeTriedEntry(positionId, entry) {
  if (!positionId) return null;

  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return {
      ...entry,
      positionId: entry.positionId || positionId,
    };
  }

  if (!entry) return null;

  return {
    positionId,
    triedAt: null,
    rating: null,
    memoryId: null,
  };
}

function normalizeTriedMap(value) {
  const tried = ensureObject(value);
  let changed = false;
  const normalized = {};

  for (const [positionId, entry] of Object.entries(tried)) {
    const nextEntry = normalizeTriedEntry(positionId, entry);
    if (!nextEntry) {
      changed = true;
      continue;
    }

    if (nextEntry !== entry || nextEntry.positionId !== entry?.positionId) {
      changed = true;
    }

    normalized[positionId] = nextEntry;
  }

  return { tried: normalized, changed };
}

function memoryToTriedEntry(memory) {
  const payload = parseTriedMemoryPayload(memory?.content);
  if (!payload?.positionId) return null;

  return {
    positionId: payload.positionId,
    title: payload.title || 'Untitled position',
    commonName: payload.commonName || null,
    mood: payload.mood || null,
    heat: payload.heat ?? null,
    triedAt: memory?.created_at || new Date().toISOString(),
    rating: payload.rating ?? null,
    memoryId: memory?.id || null,
  };
}

async function setIntimacyTriedCache(tried) {
  await storage.set(INTIMACY_TRIED_KEY, ensureObject(tried));
}

function dedupeMemories(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function buildFavoriteMemoryContent(position) {
  const label = position?.commonName ? `${position.commonName}: ${position.title}` : position?.title;
  return `Shared intimacy favorite: ${label || 'Untitled position'}`;
}

export async function getIntimacyFavorites() {
  return ensureObject(await storage.get(INTIMACY_FAVORITES_KEY, {}));
}

export async function getIntimacyTried() {
  const { tried: cachedTried, changed } = normalizeTriedMap(await storage.get(INTIMACY_TRIED_KEY, {}));
  if (changed) {
    await setIntimacyTriedCache(cachedTried);
  }

  try {
    const [personalMemories, sharedMemories] = await Promise.all([
      DataLayer.getMemories({ type: 'intimacy_tried', limit: 200 }),
      typeof DataLayer.getSharedMemories === 'function'
        ? DataLayer.getSharedMemories({ type: 'intimacy_tried', limit: 200 })
        : Promise.resolve([]),
    ]);

    const fromMemories = dedupeMemories([
      ...(Array.isArray(sharedMemories) ? sharedMemories : []),
      ...(Array.isArray(personalMemories) ? personalMemories : []),
    ])
      .map(memoryToTriedEntry)
      .filter(Boolean)
      .reduce((acc, entry) => {
        const existing = acc[entry.positionId];
        if (!existing || new Date(entry.triedAt).getTime() >= new Date(existing.triedAt).getTime()) {
          acc[entry.positionId] = entry;
        }
        return acc;
      }, {});

    const merged = {
      ...cachedTried,
      ...fromMemories,
    };

    await setIntimacyTriedCache(merged);
    return merged;
  } catch {
    return cachedTried;
  }
}

export async function toggleIntimacyFavorite(position, { currentlyFavorite = false } = {}) {
  const favorites = await getIntimacyFavorites();
  const existing = favorites[position.id] || null;

  if (currentlyFavorite) {
    if (existing?.memoryId) {
      try {
        await DataLayer.deleteMemory(existing.memoryId);
      } catch (error) {
        if (__DEV__) console.warn('[intimacyFavorites] Failed to delete favorite memory:', error?.message);
      }
    }

    delete favorites[position.id];
    await storage.set(INTIMACY_FAVORITES_KEY, favorites);
    return { favorites, hearted: false };
  }

  let memoryId = existing?.memoryId || null;
  try {
    const row = await DataLayer.saveMemory({
      type: 'intimacy_favorite',
      mood: position?.mood || 'intimate',
      content: buildFavoriteMemoryContent(position),
      isPrivate: false,
    });
    memoryId = row?.id || memoryId;
  } catch (error) {
    if (__DEV__) console.warn('[intimacyFavorites] Failed to save favorite memory:', error?.message);
  }

  favorites[position.id] = {
    positionId: position.id,
    title: position.title,
    commonName: position.commonName || null,
    mood: position.mood || null,
    heat: position.heat || null,
    savedAt: existing?.savedAt || new Date().toISOString(),
    memoryId,
  };

  await storage.set(INTIMACY_FAVORITES_KEY, favorites);
  return { favorites, hearted: true };
}

export async function toggleIntimacyTried(position, { currentlyTried = false } = {}) {
  const tried = await getIntimacyTried();
  const existing = tried[position.id] || null;

  if (currentlyTried) {
    if (existing?.memoryId) {
      try {
        await DataLayer.deleteMemory(existing.memoryId);
      } catch (error) {
        if (__DEV__) console.warn('[intimacyFavorites] Failed to delete tried memory:', error?.message);
      }
    }

    delete tried[position.id];
    await setIntimacyTriedCache(tried);
    return { tried, isTried: false };
  }

  let memoryId = existing?.memoryId || null;
  try {
    if (existing?.memoryId && typeof DataLayer.updateMemory === 'function') {
      await DataLayer.updateMemory(existing.memoryId, {
        content: JSON.stringify(buildTriedMemoryPayload(position, {
          rating: existing?.rating ?? null,
        })),
        mood: position?.mood || 'intimate',
      });
    } else {
      const row = await DataLayer.saveMemory({
        type: 'intimacy_tried',
        mood: position?.mood || 'intimate',
        content: JSON.stringify(buildTriedMemoryPayload(position, {
          rating: existing?.rating ?? null,
        })),
        isPrivate: false,
      });
      memoryId = row?.id || memoryId;
    }
  } catch (error) {
    if (__DEV__) console.warn('[intimacyFavorites] Failed to save tried memory:', error?.message);
  }

  tried[position.id] = {
    positionId: position.id,
    title: position.title,
    commonName: position.commonName || null,
    mood: position.mood || null,
    heat: position.heat || null,
    triedAt: existing?.triedAt || new Date().toISOString(),
    rating: existing?.rating || null,
    memoryId,
  };

  await setIntimacyTriedCache(tried);
  return { tried, isTried: true };
}

export async function rateIntimacyTried(position, rating) {
  if (!position?.id) return { tried: await getIntimacyTried(), entry: null };

  const tried = await getIntimacyTried();
  const existing = tried[position.id] || {};
  const nextRating = existing.rating === rating ? null : rating;

  let memoryId = existing.memoryId || null;
  if (!existing.positionId) {
    try {
      const row = await DataLayer.saveMemory({
        type: 'intimacy_tried',
        mood: position?.mood || 'intimate',
        content: JSON.stringify(buildTriedMemoryPayload(position, {
          rating: nextRating,
        })),
        isPrivate: false,
      });
      memoryId = row?.id || null;
    } catch (error) {
      if (__DEV__) console.warn('[intimacyFavorites] Failed to save tried memory:', error?.message);
    }
  } else if (existing.memoryId && typeof DataLayer.updateMemory === 'function') {
    try {
      await DataLayer.updateMemory(existing.memoryId, {
        content: JSON.stringify(buildTriedMemoryPayload(position, {
          rating: nextRating,
        })),
        mood: position?.mood || 'intimate',
      });
    } catch (error) {
      if (__DEV__) console.warn('[intimacyFavorites] Failed to update tried memory:', error?.message);
    }
  }

  const entry = {
    positionId: position.id,
    title: position.title,
    commonName: position.commonName || null,
    mood: position.mood || null,
    heat: position.heat || null,
    triedAt: existing.triedAt || new Date().toISOString(),
    rating: nextRating,
    memoryId,
  };

  tried[position.id] = entry;
  await setIntimacyTriedCache(tried);
  return { tried, entry };
}
