import naclUtil from 'tweetnacl-util';

import CoupleService from '../supabase/CoupleService';
import CloudEngine from '../storage/CloudEngine';
import CoupleKeyService from '../security/CoupleKeyService';
import StorageRouter from '../storage/StorageRouter';
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

  const partnerPubKeyB64 = await cloudEngine.waitForPartnerPublicKey(coupleId, waitTimeoutMs, waitIntervalMs);
  if (!partnerPubKeyB64) {
    throw new Error('Link created, but secure setup is still finishing. Ask your partner to reopen the invite screen, then try again.');
  }

  const partnerPubKey = naclUtil.decodeBase64(partnerPubKeyB64);
  const coupleKey = await coupleKeyService.deriveFromKeyExchange(partnerPubKey);
  await coupleKeyService.storeCoupleKey(coupleId, coupleKey);

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