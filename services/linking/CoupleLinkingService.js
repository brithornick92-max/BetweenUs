import SupabaseAuthService from '../supabase/SupabaseAuthService';
import StorageRouter from '../storage/StorageRouter';
import CloudEngine from '../storage/CloudEngine';
import CoupleKeyService from '../security/CoupleKeyService';
import CoupleService from '../supabase/CoupleService';
import { makePairingPayload, parsePairingPayload } from '../security/PairingPayload';
import {
  backfillWrappedKeysFromLocalKey,
  deriveAndPersistWrappedCoupleKey,
  restoreWrappedCoupleKeyFromCloud,
} from '../security/WrappedCoupleKeyFlow';
import { finalizeInviteCodeLink } from './InviteCodeLinking';
import { STORAGE_KEYS, storage } from '../../utils/storage';

function getDependencies(dependencies = {}) {
  return {
    supabaseAuthService: dependencies.supabaseAuthService ?? SupabaseAuthService,
    storageRouter: dependencies.storageRouter ?? StorageRouter,
    cloudEngine: dependencies.cloudEngine ?? CloudEngine,
    coupleKeyService: dependencies.coupleKeyService ?? CoupleKeyService,
    coupleService: dependencies.coupleService ?? CoupleService,
    storageApi: dependencies.storageApi ?? storage,
  };
}

async function ensureLinkingSession({ onStatus, dependencies = {} } = {}) {
  const { supabaseAuthService, storageRouter } = getDependencies(dependencies);

  const session = await supabaseAuthService.getSession().catch((error) => {
    if (String(error?.message || '').includes('Supabase is not configured')) {
      onStatus?.("Sync isn't available in this build.");
      return null;
    }
    return null;
  });

  if (session) {
    await storageRouter.setSupabaseSession(session);
    return session;
  }

  onStatus?.('Creating secure session...');
  const retrySession = await supabaseAuthService.signInAnonymously().catch(() => null);
  if (retrySession) {
    await storageRouter.setSupabaseSession(retrySession);
    return retrySession;
  }

  onStatus?.('Cloud session expired. Please sign in again via Cloud Sync.');
  return null;
}

async function initializeLinking({ onStatus, dependencies = {} } = {}) {
  const { cloudEngine, storageRouter } = getDependencies(dependencies);
  const session = await ensureLinkingSession({ onStatus, dependencies });
  if (!session) return null;
  await cloudEngine.initialize({ supabaseSessionPresent: true });
  await storageRouter.setSupabaseSession(session);
  return session;
}

export async function preparePairingQrCode({ userId, updateProfile, onStatus, dependencies = {} } = {}) {
  const { cloudEngine, coupleKeyService, coupleService, storageRouter, storageApi } = getDependencies(dependencies);

  onStatus?.('Preparing secure link...');
  const session = await initializeLinking({ onStatus, dependencies });
  if (!session) return null;

  const myPublicKeyB64 = await coupleKeyService.getDevicePublicKeyB64();
  const storedCoupleId = await storageApi.get(STORAGE_KEYS.COUPLE_ID, null);
  let coupleId = storedCoupleId || null;
  let isRepairFlow = false;

  if (!coupleId) {
    const membership = await coupleService.getMyCouple().catch(() => null);
    coupleId = membership?.couple_id || null;
  }

  if (coupleId) {
    isRepairFlow = true;
    await cloudEngine.joinCouple(coupleId, myPublicKeyB64);
    await storageRouter.setActiveCoupleId(coupleId);
    await storageApi.set(STORAGE_KEYS.COUPLE_ID, coupleId);
    onStatus?.('Preparing repair code...');
  } else {
    coupleId = await cloudEngine.createCouple(myPublicKeyB64);
    await storageRouter.setActiveCoupleId(coupleId);
    if (userId) {
      await storageRouter.updateUserDocument(userId, { coupleId });
      await updateProfile?.({ coupleId });
    }
    await storageApi.set(STORAGE_KEYS.COUPLE_ID, coupleId);
  }

  const generated = await coupleService.generatePairingCode(coupleId);
  if (!generated || !generated.code) {
    throw new Error('Unable to generate pairing code. Please try again.');
  }
  const pairingCode = generated.code;

  const payload = makePairingPayload({ pairingCode, publicKey: myPublicKeyB64 });

  return {
    coupleId,
    isRepairFlow,
    qrPayload: JSON.stringify(payload),
  };
}

export async function completePairingQrHandshake({
  coupleId,
  isRepairFlow = false,
  onStatus,
  waitTimeoutMs = 600000,
  waitIntervalMs = 3000,
  dependencies = {},
} = {}) {
  const { cloudEngine } = getDependencies(dependencies);

  const partnerMembership = await cloudEngine.waitForPartnerMembership(coupleId, waitTimeoutMs, waitIntervalMs);
  if (!partnerMembership?.public_key || !partnerMembership?.user_id) {
    throw new Error('Link timed out. Please try again.');
  }

  if (isRepairFlow) {
    await backfillWrappedKeysFromLocalKey({
      coupleId,
      partnerUserId: partnerMembership.user_id,
      partnerPublicKeyB64: partnerMembership.public_key,
      dependencies,
    });
  } else {
    await deriveAndPersistWrappedCoupleKey({
      coupleId,
      partnerUserId: partnerMembership.user_id,
      partnerPublicKeyB64: partnerMembership.public_key,
      dependencies,
    });
  }

  onStatus?.(isRepairFlow ? 'Secure pairing repaired.' : 'Connected successfully!');
  return partnerMembership;
}

export async function joinWithInviteCode({ code, userId, updateProfile, onStatus, dependencies = {} } = {}) {
  const { coupleKeyService, coupleService } = getDependencies(dependencies);

  onStatus?.('Connecting...');
  const session = await initializeLinking({ onStatus, dependencies });
  if (!session) return null;

  const myPublicKeyB64 = await coupleKeyService.getDevicePublicKeyB64();
  const { coupleId } = await coupleService.redeemInviteCode(code.trim());

  await finalizeInviteCodeLink({
    coupleId,
    userId,
    updateProfile,
    myPublicKeyB64,
    dependencies,
  });

  onStatus?.('Linked successfully!');
  return { coupleId };
}

export async function scanPairingCode({ rawPayload, userId, updateProfile, onStatus, dependencies = {} } = {}) {
  const { coupleKeyService, coupleService, storageRouter, storageApi } = getDependencies(dependencies);

  const session = await initializeLinking({ onStatus, dependencies });
  if (!session) return null;

  const parsed = parsePairingPayload(rawPayload);
  if (!parsed.ok) throw new Error(parsed.error);

  const { pairingCode, publicKey: inviterPublicKeyB64 } = parsed.payload;
  const existingCoupleId = await storageApi.get(STORAGE_KEYS.COUPLE_ID, null);

  onStatus?.('Establishing secure bridge...');
  const myPublicKeyB64 = await coupleKeyService.getDevicePublicKeyB64();
  const { coupleId, partnerId } = await coupleService.redeemPairingCode(pairingCode, myPublicKeyB64);

  // A true repair flow means we are re-syncing keys for the SAME couple. 
  // If the couple IDs differ, the user is joining a completely new couple, overriding old local state.
  const isRepairFlow = !!existingCoupleId && existingCoupleId === coupleId;

  if (isRepairFlow) {
    const restoredKey = await restoreWrappedCoupleKeyFromCloud(coupleId, {
      timeoutMs: 120000,
      intervalMs: 3000,
      dependencies,
    });
    if (!restoredKey) {
      throw new Error('Repair started, but the wrapped key is not available yet. Ask your partner to keep the repair screen open and try again.');
    }
  } else {
    await deriveAndPersistWrappedCoupleKey({
      coupleId,
      partnerUserId: partnerId,
      partnerPublicKeyB64: inviterPublicKeyB64,
      dependencies,
    });
  }

  await storageRouter.setActiveCoupleId(coupleId);
  if (userId) {
    await storageRouter.updateUserDocument(userId, { coupleId });
    await updateProfile?.({ coupleId });
  }
  await storageApi.set(STORAGE_KEYS.COUPLE_ID, coupleId);

  onStatus?.(isRepairFlow ? 'Secure pairing repaired.' : 'Successfully paired.');
  return { coupleId, isRepairFlow };
}

export default {
  ensureLinkingSession,
  preparePairingQrCode,
  completePairingQrHandshake,
  joinWithInviteCode,
  scanPairingCode,
};