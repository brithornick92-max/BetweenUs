import { DataLayer } from '../services/localfirst';

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

function buildFavoriteMemoryPayload(position) {
  return {
    kind: 'intimacy_favorite',
    positionId: position?.id,
    title: position?.title || 'Untitled position',
    commonName: position?.commonName || null,
    mood: position?.mood || null,
    heat: position?.heat ?? null,
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

function parseFavoriteMemoryPayload(content) {
  if (!content) return null;
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return parsed?.kind === 'intimacy_favorite' ? parsed : null;
  } catch {
    return null;
  }
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

function dedupeMemories(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function memoryToFavoriteEntry(memory) {
  const payload = parseFavoriteMemoryPayload(memory?.content);
  if (!payload?.positionId) return null;

  return {
    positionId: payload.positionId,
    title: payload.title || 'Untitled position',
    commonName: payload.commonName || null,
    mood: payload.mood || null,
    heat: payload.heat ?? null,
    savedAt: memory?.created_at || new Date().toISOString(),
    memoryId: memory?.id || null,
  };
}

export async function getIntimacyFavorites() {
  try {
    const [personalMemories, sharedMemories] = await Promise.all([
      DataLayer.getMemories({ type: 'intimacy_favorite', limit: 200 }),
      typeof DataLayer.getSharedMemories === 'function'
        ? DataLayer.getSharedMemories({ type: 'intimacy_favorite', limit: 200 })
        : Promise.resolve([]),
    ]);

    return dedupeMemories([
      ...(Array.isArray(sharedMemories) ? sharedMemories : []),
      ...(Array.isArray(personalMemories) ? personalMemories : []),
    ])
      .map(memoryToFavoriteEntry)
      .filter(Boolean)
      .reduce((acc, entry) => {
        const existing = acc[entry.positionId];
        if (!existing || new Date(entry.savedAt).getTime() >= new Date(existing.savedAt).getTime()) {
          acc[entry.positionId] = entry;
        }
        return acc;
      }, {});
  } catch {
    return {};
  }
}

export async function getIntimacyTried() {
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

    return fromMemories;
  } catch {
    return {};
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
    return { favorites, hearted: false };
  }

  let memoryId = existing?.memoryId || null;
  try {
    const row = await DataLayer.saveMemory({
      type: 'intimacy_favorite',
      mood: position?.mood || 'intimate',
      content: JSON.stringify(buildFavoriteMemoryPayload(position)),
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

  return { favorites, hearted: true };
}

export async function toggleIntimacyTried(position, { currentlyTried = false, currentTried = null } = {}) {
  const tried = currentTried ? { ...ensureObject(currentTried) } : await getIntimacyTried();
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
  return { tried, entry };
}
