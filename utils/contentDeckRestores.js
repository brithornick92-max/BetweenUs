import { storage, STORAGE_KEYS } from './storage';

const DEFAULT_STATE = Object.freeze({
  prompts: [],
  dates: [],
  positions: [],
});

function normalizeType(type = 'prompts') {
  const raw = String(type || '').toLowerCase();
  if (raw === 'prompt' || raw === 'prompts') return 'prompts';
  if (raw === 'date' || raw === 'dates') return 'dates';
  if (raw === 'position' || raw === 'positions') return 'positions';
  return 'prompts';
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    prompts: Array.isArray(source.prompts) ? source.prompts.map(String) : [],
    dates: Array.isArray(source.dates) ? source.dates.map(String) : [],
    positions: Array.isArray(source.positions) ? source.positions.map(String) : [],
  };
}

export async function getContentDeckRestoreState() {
  return normalizeState(await storage.get(STORAGE_KEYS.CONTENT_DECK_RESTORES, DEFAULT_STATE));
}

export async function getRestoredDeckItemIds(type) {
  const normalizedType = normalizeType(type);
  const state = await getContentDeckRestoreState();
  return new Set((state[normalizedType] || []).map(String));
}

export async function addRestoredDeckItem(type, itemId) {
  if (!itemId) return false;
  const normalizedType = normalizeType(type);
  const state = await getContentDeckRestoreState();
  const nextIds = new Set((state[normalizedType] || []).map(String));
  nextIds.add(String(itemId));
  state[normalizedType] = Array.from(nextIds);
  return storage.set(STORAGE_KEYS.CONTENT_DECK_RESTORES, state);
}

export async function removeRestoredDeckItem(type, itemId) {
  if (!itemId) return false;
  const normalizedType = normalizeType(type);
  const state = await getContentDeckRestoreState();
  state[normalizedType] = (state[normalizedType] || []).filter((id) => String(id) !== String(itemId));
  return storage.set(STORAGE_KEYS.CONTENT_DECK_RESTORES, state);
}
