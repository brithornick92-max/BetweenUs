import naclUtil from 'tweetnacl-util';

import CoupleKeyService from './CoupleKeyService';
import CoupleService from '../supabase/CoupleService';
import CloudEngine from '../storage/CloudEngine';

export async function persistWrappedKeyForCurrentDevice(coupleId, coupleKey, dependencies = {}) {
  const coupleKeyService = dependencies.coupleKeyService ?? CoupleKeyService;
  const coupleService = dependencies.coupleService ?? CoupleService;

  const myPublicKeyB64 = await coupleKeyService.getDevicePublicKeyB64();
  const myWrappedKey = await coupleKeyService.wrapKeyForDevice(
    coupleKey,
    naclUtil.decodeBase64(myPublicKeyB64)
  );
  await coupleService.setMyWrappedCoupleKey(coupleId, myWrappedKey);
  return myWrappedKey;
}

export async function shareWrappedKeyWithMember(coupleId, coupleKey, targetUserId, targetPublicKeyB64, dependencies = {}) {
  if (!targetUserId || !targetPublicKeyB64) return null;
  const coupleKeyService = dependencies.coupleKeyService ?? CoupleKeyService;
  const coupleService = dependencies.coupleService ?? CoupleService;

  const wrappedKey = await coupleKeyService.wrapKeyForDevice(
    coupleKey,
    naclUtil.decodeBase64(targetPublicKeyB64)
  );
  await coupleService.setWrappedCoupleKeyForMember(coupleId, targetUserId, wrappedKey);
  return wrappedKey;
}

export async function deriveAndPersistWrappedCoupleKey({ coupleId, partnerUserId, partnerPublicKeyB64, dependencies = {} }) {
  const coupleKeyService = dependencies.coupleKeyService ?? CoupleKeyService;
  const coupleKey = await coupleKeyService.deriveFromKeyExchange(naclUtil.decodeBase64(partnerPublicKeyB64));
  await coupleKeyService.storeCoupleKey(coupleId, coupleKey);
  await persistWrappedKeyForCurrentDevice(coupleId, coupleKey, dependencies);
  if (partnerUserId && partnerPublicKeyB64) {
    await shareWrappedKeyWithMember(coupleId, coupleKey, partnerUserId, partnerPublicKeyB64, dependencies);
  }
  return coupleKey;
}

export async function restoreWrappedCoupleKeyFromCloud(coupleId, { timeoutMs = 120000, intervalMs = 3000, dependencies = {} } = {}) {
  const coupleKeyService = dependencies.coupleKeyService ?? CoupleKeyService;
  const cloudEngine = dependencies.cloudEngine ?? CloudEngine;

  const wrappedKey = await cloudEngine.waitForMyWrappedCoupleKey(coupleId, timeoutMs, intervalMs);
  if (!wrappedKey) return null;

  const coupleKey = await coupleKeyService.unwrapKeyForDevice(wrappedKey);
  if (!coupleKey?.length) return null;
  await coupleKeyService.storeCoupleKey(coupleId, coupleKey);
  return coupleKey;
}

export async function backfillWrappedKeysFromLocalKey({ coupleId, partnerUserId, partnerPublicKeyB64, dependencies = {} }) {
  const coupleKeyService = dependencies.coupleKeyService ?? CoupleKeyService;
  const coupleKey = await coupleKeyService.getCoupleKey(coupleId);
  if (!coupleKey) {
    throw new Error('This device cannot restore the shared key. Use a device that can still open shared content.');
  }
  await persistWrappedKeyForCurrentDevice(coupleId, coupleKey, dependencies);
  if (partnerUserId && partnerPublicKeyB64) {
    await shareWrappedKeyWithMember(coupleId, coupleKey, partnerUserId, partnerPublicKeyB64, dependencies);
  }
  return coupleKey;
}