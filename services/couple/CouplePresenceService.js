import { clearCouplePremiumCache } from '../../context/EntitlementsContext';
import CoupleService from '../supabase/CoupleService';
import CoupleKeyService from '../security/CoupleKeyService';
import StorageRouter from '../storage/StorageRouter';
import { storage, STORAGE_KEYS } from '../../utils/storage';

function getDependencies(dependencies = {}) {
  return {
    coupleService: dependencies.coupleService ?? CoupleService,
    coupleKeyService: dependencies.coupleKeyService ?? CoupleKeyService,
    storageRouter: dependencies.storageRouter ?? StorageRouter,
    storageApi: dependencies.storageApi ?? storage,
  };
}

function callWithTimeout(factory, timeoutMs) {
  let timeoutId;
  return Promise.race([
    factory(),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function clearLocalCoupleState({
  coupleId,
  userId,
  onProfileCleared,
  dependencies = {},
} = {}) {
  const { coupleKeyService, storageRouter, storageApi } = getDependencies(dependencies);

  await storageApi.remove(STORAGE_KEYS.COUPLE_ID);
  await storageApi.remove(STORAGE_KEYS.COUPLE_ROLE);
  await storageApi.remove(STORAGE_KEYS.PARTNER_PROFILE);
  await storageApi.remove(STORAGE_KEYS.LAST_PARTNER_ACTIVITY);
  await clearCouplePremiumCache();

  if (coupleId) {
    try {
      await coupleKeyService.clearCoupleKey(coupleId);
    } catch (e) {
      console.warn('[CouplePresence] Failed to clear couple key:', e);
    }
  }

  if (userId) {
    try {
      await storageRouter.updateUserDocument(userId, { coupleId: null });
    } catch (e) {
      console.warn('[CouplePresence] Failed to update user doc:', e);
    }
  }

  await onProfileCleared?.({ coupleId: null });
  return true;
}

export async function unlinkCouple({ coupleId, userId, onProfileCleared, dependencies = {} } = {}) {
  const { coupleService } = getDependencies(dependencies);
  await coupleService.unlinkFromCouple();
  await clearLocalCoupleState({ coupleId, userId, onProfileCleared, dependencies });
  return true;
}

export async function getRemoteCoupleId({ dependencies = {}, timeoutMs = 10000 } = {}) {
  const { coupleService } = getDependencies(dependencies);
  const remoteCouple = await callWithTimeout(() => coupleService.getMyCouple(), timeoutMs);
  return remoteCouple?.couple_id || null;
}

export async function getVerifiedCoupleState({
  currentCoupleId = null,
  userId,
  updateProfile,
  requireRemoteCheck = false,
  confirmMiss = true,
  dependencies = {},
} = {}) {
  const { coupleKeyService, storageApi } = getDependencies(dependencies);
  let localCoupleId = currentCoupleId;
  if (localCoupleId === undefined || localCoupleId === null) {
    localCoupleId = await storageApi.get(STORAGE_KEYS.COUPLE_ID, null);
  }

  let resolvedCoupleId = localCoupleId || null;
  let remoteCoupleId = null;
  let remoteChecked = false;
  let remoteError = false;

  if (requireRemoteCheck) {
    try {
      remoteCoupleId = await getRemoteCoupleId({ dependencies });
      remoteChecked = true;
    } catch (_) {
      remoteChecked = false;
      remoteError = true;
    }

    if (remoteChecked) {
      if (remoteCoupleId && remoteCoupleId !== resolvedCoupleId) {
        resolvedCoupleId = remoteCoupleId;
        await storageApi.set(STORAGE_KEYS.COUPLE_ID, remoteCoupleId);
        await updateProfile?.({ coupleId: remoteCoupleId });
      } else if (!remoteCoupleId && resolvedCoupleId && confirmMiss) {
        let confirmedMissing = false;
        try {
          const recheckCoupleId = await getRemoteCoupleId({ dependencies, timeoutMs: 8000 });
          confirmedMissing = !recheckCoupleId;
        } catch (e) {
          console.warn('[CouplePresence] Remote miss double-check failed:', e);
          confirmedMissing = false;
        }

        if (confirmedMissing) {
          await clearLocalCoupleState({
            coupleId: resolvedCoupleId,
            userId,
            onProfileCleared: updateProfile,
            dependencies,
          });
          resolvedCoupleId = null;
        }
      }
    }
  }

  const hasCoupleKey = resolvedCoupleId
    ? await coupleKeyService.hasCoupleKey(resolvedCoupleId).catch(() => false)
    : false;

  return {
    coupleId: resolvedCoupleId,
    remoteCoupleId,
    remoteChecked,
    remoteError,
    hasCoupleKey,
    status: !resolvedCoupleId
      ? 'unpaired'
      : hasCoupleKey
        ? 'paired_key_ready'
        : 'paired_key_missing',
  };
}

export default {
  clearLocalCoupleState,
  unlinkCouple,
  getRemoteCoupleId,
  getVerifiedCoupleState,
};