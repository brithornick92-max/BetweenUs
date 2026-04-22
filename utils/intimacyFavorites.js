import { DataLayer } from '../services/localfirst';
import { storage } from './storage';

export const INTIMACY_FAVORITES_KEY = '@betweenus:intimacy_favorites';

const ensureObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

function buildFavoriteMemoryContent(position) {
  const label = position?.commonName ? `${position.commonName}: ${position.title}` : position?.title;
  return `Shared intimacy favorite: ${label || 'Untitled position'}`;
}

export async function getIntimacyFavorites() {
  return ensureObject(await storage.get(INTIMACY_FAVORITES_KEY, {}));
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