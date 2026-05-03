import { SupabaseAuthService } from '../supabase/SupabaseAuthService';
import StorageRouter from '../storage/StorageRouter';
import CloudEngine from '../storage/CloudEngine';
import CoupleService from '../supabase/CoupleService';
import { finalizeInviteCodeLink } from './InviteCodeLinking';
import { storage } from '../../utils/storage';

function getDependencies(dependencies = {}) {
  return {
    supabaseAuthService: dependencies.supabaseAuthService ?? SupabaseAuthService,
    storageRouter: dependencies.storageRouter ?? StorageRouter,
    cloudEngine: dependencies.cloudEngine ?? CloudEngine,
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

  onStatus?.('Sign in required before linking.');
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

export async function joinWithInviteCode({ code, userId, updateProfile, onStatus, dependencies = {} } = {}) {
  const { coupleService } = getDependencies(dependencies);

  onStatus?.('Connecting...');
  const session = await initializeLinking({ onStatus, dependencies });
  if (!session) return null;

  // Server-side RPC handles removing the code and setting up the couple
  const { coupleId } = await coupleService.redeemInviteCode(code.trim());

  await finalizeInviteCodeLink({
    coupleId,
    userId,
    updateProfile,
    dependencies,
  });

  onStatus?.('Linked successfully!');
  return { coupleId };
}

export default {
  ensureLinkingSession,
  joinWithInviteCode,
};
