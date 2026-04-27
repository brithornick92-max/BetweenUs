import { DataLayer } from '../services/localfirst';
import { storage } from './storage';

export const INTIMACY_FAVORITES_KEY = '@betweenus:cache:intimacyFavorites';
export const INTIMACY_TRIED_KEY = '@betweenus:cache:intimacyPositionsTried';

const ensureObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

function buildFavoriteMemoryContent(position) {
  const label = position?.commonName ? `${position.commonName}: ${position.title}` : position?.title;
  return `Shared intimacy favorite: ${label || 'Untitled position'}`;
}

function buildTriedMemoryContent(position) {
  const label = position?.commonName ? `${position.commonName}: ${position.title}` : position?.title;
  return `Tried intimacy position: ${label || 'Untitled position'}`;
}

export async function getIntimacyFavorites() {
  return ensureObject(await storage.get(INTIMACY_FAVORITES_KEY, {}));
}

export async function getIntimacyTried() {
  return ensureObject(await storage.get(INTIMACY_TRIED_KEY, {}));
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
    await storage.set(INTIMACY_TRIED_KEY, tried);
    return { tried, isTried: false };
  }

  let memoryId = existing?.memoryId || null;
  try {
    const row = await DataLayer.saveMemory({
      type: 'intimacy_tried',
      mood: position?.mood || 'intimate',
      content: buildTriedMemoryContent(position),
      isPrivate: false,
    });
    memoryId = row?.id || memoryId;
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

  await storage.set(INTIMACY_TRIED_KEY, tried);
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
        content: buildTriedMemoryContent(position),
        isPrivate: false,
      });
      memoryId = row?.id || null;
    } catch (error) {
      if (__DEV__) console.warn('[intimacyFavorites] Failed to save tried memory:', error?.message);
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
  await storage.set(INTIMACY_TRIED_KEY, tried);
  return { tried, entry };
}
