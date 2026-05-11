import StorageRouter from '../storage/StorageRouter';
import { STORAGE_KEYS, storage } from '../../utils/storage';

export const SHARED_ANNIVERSARY_KEY = 'relationship_start_date';
export const PENDING_SHARED_ANNIVERSARY_KEY = '@betweenus:cache:pendingSharedAnniversaryDate';
export const SHARED_DAILY_PROMPT_KEY_PREFIX = 'daily_prompt';
export const SHARED_DAILY_QUIZ_KEY_PREFIX = 'daily_quiz';
export const SHARED_DAILY_SELECTION_DATA_TYPE = 'couple_state';

function getDependencies(dependencies = {}) {
  return {
    storageRouter: dependencies.storageRouter ?? StorageRouter,
    storageApi: dependencies.storageApi ?? storage,
  };
}

export function getSharedDailyPromptKey(dateKey) {
  return `${SHARED_DAILY_PROMPT_KEY_PREFIX}_${dateKey}`;
}

export function getSharedDailyQuizKey(dateKey) {
  return `${SHARED_DAILY_QUIZ_KEY_PREFIX}_${dateKey}`;
}

export async function getActiveCoupleId({
  fallbackCoupleId = null,
  allowStoredFallback = true,
  dependencies = {},
} = {}) {
  const { storageApi } = getDependencies(dependencies);
  if (fallbackCoupleId) return fallbackCoupleId;
  if (!allowStoredFallback) return null;
  return (await storageApi.get(STORAGE_KEYS.COUPLE_ID, null)) || null;
}

export async function getSharedDailyPromptSelection(dateKey, {
  fallbackCoupleId = null,
  allowStoredFallback = true,
  ensureSession,
  dependencies = {},
} = {}) {
  const { storageRouter } = getDependencies(dependencies);
  const coupleId = await getActiveCoupleId({ fallbackCoupleId, allowStoredFallback, dependencies });
  if (!coupleId) return null;

  if (ensureSession) {
    const session = await ensureSession();
    if (!session) return null;
  }
  return storageRouter.getCoupleData(coupleId, getSharedDailyPromptKey(dateKey)).catch(() => null);
}

export async function saveSharedDailyPromptSelection(dateKey, promptId, userId, {
  fallbackCoupleId = null,
  allowStoredFallback = true,
  ensureSession,
  assignment = null,
  dependencies = {},
} = {}) {
  if (!dateKey || !promptId || !userId) return false;

  const { storageRouter } = getDependencies(dependencies);
  const coupleId = await getActiveCoupleId({ fallbackCoupleId, allowStoredFallback, dependencies });
  if (!coupleId) return false;

  if (ensureSession) {
    const session = await ensureSession();
    if (!session) return false;
  }
  return storageRouter.upsertCoupleData(
    coupleId,
    getSharedDailyPromptKey(dateKey),
    {
      ...(assignment && typeof assignment === 'object' ? assignment : {}),
      promptId,
      dateKey,
    },
    userId,
    false,
    SHARED_DAILY_SELECTION_DATA_TYPE,
    { preserveOnDuplicate: true }
  );
}

export async function getSharedDailyQuizQuestionSelection(dateKey, {
  fallbackCoupleId = null,
  allowStoredFallback = true,
  ensureSession,
  dependencies = {},
} = {}) {
  const { storageRouter } = getDependencies(dependencies);
  const coupleId = await getActiveCoupleId({ fallbackCoupleId, allowStoredFallback, dependencies });
  if (!coupleId) return null;

  if (ensureSession) {
    const session = await ensureSession();
    if (!session) return null;
  }
  return storageRouter.getCoupleData(coupleId, getSharedDailyQuizKey(dateKey)).catch(() => null);
}

export async function saveSharedDailyQuizQuestionSelection(dateKey, questionId, userId, {
  fallbackCoupleId = null,
  allowStoredFallback = true,
  ensureSession,
  dependencies = {},
} = {}) {
  if (!dateKey || !questionId || !userId) return false;

  const { storageRouter } = getDependencies(dependencies);
  const coupleId = await getActiveCoupleId({ fallbackCoupleId, allowStoredFallback, dependencies });
  if (!coupleId) return false;

  if (ensureSession) {
    const session = await ensureSession();
    if (!session) return false;
  }
  return storageRouter.upsertCoupleData(
    coupleId,
    getSharedDailyQuizKey(dateKey),
    { questionId, dateKey },
    userId,
    false,
    SHARED_DAILY_SELECTION_DATA_TYPE,
    { preserveOnDuplicate: true }
  );
}

export async function syncSharedAnniversary(startDate, userId, {
  fallbackCoupleId = null,
  allowStoredFallback = true,
  ensureSession,
  dependencies = {},
} = {}) {
  if (!startDate || !userId) return false;

  const { storageRouter } = getDependencies(dependencies);
  const coupleId = await getActiveCoupleId({ fallbackCoupleId, allowStoredFallback, dependencies });
  if (!coupleId) return false;

  if (ensureSession) {
    const session = await ensureSession();
    if (!session) return false;
  }
  return storageRouter.upsertCoupleData(
    coupleId,
    SHARED_ANNIVERSARY_KEY,
    { startDate },
    userId,
    false,
    'couple_state'
  );
}

export async function getSharedAnniversary({
  fallbackCoupleId = null,
  allowStoredFallback = true,
  ensureSession,
  dependencies = {},
} = {}) {
  const { storageRouter } = getDependencies(dependencies);
  const coupleId = await getActiveCoupleId({ fallbackCoupleId, allowStoredFallback, dependencies });
  if (!coupleId) return null;

  if (ensureSession) {
    const session = await ensureSession();
    if (!session) return null;
  }
  return storageRouter.getCoupleData(coupleId, SHARED_ANNIVERSARY_KEY).catch((err) => {
    if (__DEV__) console.warn('[CoupleStateService] Shared anniversary fetch failed:', err?.message);
    return null;
  });
}

export async function getPendingSharedAnniversary(dependencies = {}) {
  const { storageApi } = getDependencies(dependencies);
  return storageApi.get(PENDING_SHARED_ANNIVERSARY_KEY, null);
}

export async function setPendingSharedAnniversary(startDate, dependencies = {}) {
  const { storageApi } = getDependencies(dependencies);
  await storageApi.set(PENDING_SHARED_ANNIVERSARY_KEY, startDate);
}

export async function clearPendingSharedAnniversary(dependencies = {}) {
  const { storageApi } = getDependencies(dependencies);
  await storageApi.remove(PENDING_SHARED_ANNIVERSARY_KEY);
}

export async function subscribeToSharedAnniversary({
  userId,
  currentRelationshipStartDate,
  getCurrentRelationshipStartDate,
  ensureSession,
  normalizeRelationshipStartDate,
  onRemoteUpdate,
  dependencies = {},
} = {}) {
  if (!userId || typeof onRemoteUpdate !== 'function' || typeof normalizeRelationshipStartDate !== 'function') {
    return null;
  }

  const coupleId = await getActiveCoupleId({ dependencies });
  if (!coupleId) return null;

  const session = await ensureSession?.();
  if (!session) return null;

  const { supabase, TABLES } = await import('../../config/supabase');
  if (!supabase) return null;

  const channel = supabase
    .channel(`shared_anniversary_${coupleId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: TABLES.COUPLE_DATA,
        filter: `couple_id=eq.${coupleId}`,
      },
      async (payload) => {
        const row = payload?.new;
        if (!row || row.key !== SHARED_ANNIVERSARY_KEY || row.created_by === userId) {
          return;
        }

        const nextDate = normalizeRelationshipStartDate(
          row?.value?.startDate || row?.value?.relationshipStartDate || row?.value
        );
        
        const rawCurrent = typeof getCurrentRelationshipStartDate === 'function'
          ? getCurrentRelationshipStartDate()
          : (typeof currentRelationshipStartDate === 'function' ? currentRelationshipStartDate() : currentRelationshipStartDate);
        
        const currentDate = normalizeRelationshipStartDate(rawCurrent);

        if (!nextDate || nextDate === currentDate) return;
        await onRemoteUpdate(nextDate);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export default {
  SHARED_ANNIVERSARY_KEY,
  PENDING_SHARED_ANNIVERSARY_KEY,
  getActiveCoupleId,
  getSharedDailyPromptKey,
  getSharedDailyQuizKey,
  getSharedDailyPromptSelection,
  saveSharedDailyPromptSelection,
  getSharedDailyQuizQuestionSelection,
  saveSharedDailyQuizQuestionSelection,
  syncSharedAnniversary,
  getSharedAnniversary,
  getPendingSharedAnniversary,
  setPendingSharedAnniversary,
  clearPendingSharedAnniversary,
  subscribeToSharedAnniversary,
};
