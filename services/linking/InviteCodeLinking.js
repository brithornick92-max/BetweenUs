import CoupleService from '../supabase/CoupleService';
import CloudEngine from '../storage/CloudEngine';
import StorageRouter from '../storage/StorageRouter';
import { STORAGE_KEYS, storage } from '../../utils/storage';

export async function finalizeInviteCodeLink({
  coupleId,
  userId,
  updateProfile,
  dependencies = {},
}) {
  if (!coupleId) {
    throw new Error('Link completed remotely, but no couple was returned. Please try again.');
  }

  const cloudEngine = dependencies.cloudEngine ?? CloudEngine;
  const storageRouter = dependencies.storageRouter ?? StorageRouter;
  const storageApi = dependencies.storageApi ?? storage;

  // Join the couple in Supabase (inserts couple_members row if not already present)
  await cloudEngine.joinCouple(coupleId);

  await storageRouter.setActiveCoupleId(coupleId);
  if (userId) {
    await storageRouter.updateUserDocument(userId, { coupleId });
    await updateProfile?.({ coupleId });
  }
  await storageApi.set(STORAGE_KEYS.COUPLE_ID, coupleId);

  return coupleId;
}

export async function recoverExistingInviteCodeLink({
  userId,
  updateProfile,
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
    dependencies,
  });
}
