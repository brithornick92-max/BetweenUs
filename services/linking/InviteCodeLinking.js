import CoupleService from '../supabase/CoupleService';
import CloudEngine from '../storage/CloudEngine';
import CoupleKeyService from '../security/CoupleKeyService';
import StorageRouter from '../storage/StorageRouter';
import { backfillWrappedKeysFromLocalKey, deriveAndPersistWrappedCoupleKey } from '../security/WrappedCoupleKeyFlow';
import { STORAGE_KEYS, storage } from '../../utils/storage';

export async function finalizeInviteCodeLink({
  coupleId,
  userId,
  updateProfile,
  myPublicKeyB64,
  waitTimeoutMs = 20000,
  waitIntervalMs = 1000,
  dependencies = {},
}) {
  if (!coupleId) {
    throw new Error('Link completed remotely, but no couple was returned. Please try again.');
  }

  const cloudEngine = dependencies.cloudEngine ?? CloudEngine;
  const coupleKeyService = dependencies.coupleKeyService ?? CoupleKeyService;
  const storageRouter = dependencies.storageRouter ?? StorageRouter;
  const storageApi = dependencies.storageApi ?? storage;

  await cloudEngine.joinCouple(coupleId, myPublicKeyB64);

  await storageRouter.setActiveCoupleId(coupleId);
  if (userId) {
    await storageRouter.updateUserDocument(userId, { coupleId });
    await updateProfile?.({ coupleId });
  }
  await storageApi.set(STORAGE_KEYS.COUPLE_ID, coupleId);

  const partnerMembership = await cloudEngine.waitForPartnerMembership(coupleId, waitTimeoutMs, waitIntervalMs);
  if (!partnerMembership?.public_key || !partnerMembership?.user_id) {
    throw new Error('Link created, but secure setup is still finishing. Ask your partner to reopen the invite screen, then try again.');
  }

  const existingCoupleKey = await coupleKeyService.getCoupleKey(coupleId);
  if (existingCoupleKey) {
    await backfillWrappedKeysFromLocalKey({
      coupleId,
      partnerUserId: partnerMembership.user_id,
      partnerPublicKeyB64: partnerMembership.public_key,
      dependencies: { coupleKeyService, coupleService: CoupleService, cloudEngine },
    });
  } else {
    await deriveAndPersistWrappedCoupleKey({
      coupleId,
      partnerUserId: partnerMembership.user_id,
      partnerPublicKeyB64: partnerMembership.public_key,
      dependencies: { coupleKeyService, coupleService: CoupleService, cloudEngine },
    });
  }

  return coupleId;
}

export async function recoverExistingInviteCodeLink({
  userId,
  updateProfile,
  myPublicKeyB64,
  waitTimeoutMs = 20000,
  waitIntervalMs = 1000,
  dependencies = {},
}) {
  const coupleService = dependencies.coupleService ?? CoupleService;
  const existingCouple = await coupleService.getMyCouple();
  const coupleId = existingCouple?.couple_id;

  if (!coupleId) {
    return null;
  }

  return finalizeInviteCodeLink({
    coupleId,
    userId,
    updateProfile,
    myPublicKeyB64,
    waitTimeoutMs,
    waitIntervalMs,
    dependencies,
  });
}