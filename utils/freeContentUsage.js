import PremiumGatekeeper from '../services/PremiumGatekeeper';
import { storage } from './storage';

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function seenKey(userId, type, itemId) {
  return `free_content_seen:${userId || 'anonymous'}:${localDayKey()}:${type}:${itemId}`;
}

async function hasAlreadyTrackedView(userId, type, itemId) {
  return storage.get(seenKey(userId, type, itemId), false);
}

async function markTrackedView(userId, type, itemId) {
  return storage.set(seenKey(userId, type, itemId), true);
}

export async function trackFreePromptView({ userId, isPremium, prompt }) {
  if (isPremium || !userId || !prompt?.id) {
    return { tracked: false, skipped: true, allowed: true };
  }

  if (await hasAlreadyTrackedView(userId, 'prompt', prompt.id)) {
    return { tracked: false, alreadyTracked: true, allowed: true };
  }

  const result = await PremiumGatekeeper.trackPromptUsage(userId, prompt.id, false, prompt?.heat || 1);

  if (result?.canAccess === false) {
    return { ...result, tracked: false, allowed: false };
  }

  await markTrackedView(userId, 'prompt', prompt.id);
  return { ...result, tracked: true, allowed: true };
}

export async function trackFreeDateView({ userId, isPremium, date }) {
  if (isPremium || !userId || !date?.id) {
    return { tracked: false, skipped: true, allowed: true };
  }

  if (await hasAlreadyTrackedView(userId, 'date', date.id)) {
    return { tracked: false, alreadyTracked: true, allowed: true };
  }

  const result = await PremiumGatekeeper.trackDateUsage(userId, date.id, false);

  if (result?.canAccess === false) {
    return { ...result, tracked: false, allowed: false };
  }

  await markTrackedView(userId, 'date', date.id);
  return { ...result, tracked: true, allowed: true };
}
