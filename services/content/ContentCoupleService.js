import E2EEncryption from '../e2ee/E2EEncryption';
import StorageRouter from '../storage/StorageRouter';
import CoupleStateService from '../couple/CoupleStateService';

function getDependencies(dependencies = {}) {
  return {
    encryptionService: dependencies.encryptionService ?? E2EEncryption,
    storageRouter: dependencies.storageRouter ?? StorageRouter,
    coupleStateService: dependencies.coupleStateService ?? CoupleStateService,
  };
}

export async function getPromptCoupleContext({ fallbackCoupleId = null, dependencies = {} } = {}) {
  const { coupleStateService } = getDependencies(dependencies);
  const coupleId = await coupleStateService.getActiveCoupleId({ fallbackCoupleId, dependencies });
  return {
    coupleId,
    keyTier: coupleId ? 'couple' : 'device',
  };
}

export async function getSharedDailyPromptSelection(dateKey, options = {}) {
  const { coupleStateService } = getDependencies(options.dependencies);
  return coupleStateService.getSharedDailyPromptSelection(dateKey, options);
}

export async function saveSharedDailyPromptSelection(dateKey, promptId, userId, options = {}) {
  const { coupleStateService } = getDependencies(options.dependencies);
  return coupleStateService.saveSharedDailyPromptSelection(dateKey, promptId, userId, options);
}

export async function buildPromptResponseRecord(promptId, response, {
  isPrivate = false,
  fallbackCoupleId = null,
  dependencies = {},
} = {}) {
  const { encryptionService } = getDependencies(dependencies);

  const responseData = {
    content: response,
    timestamp: Date.now(),
    promptId,
  };

  const { coupleId, keyTier } = await getPromptCoupleContext({ fallbackCoupleId, dependencies });
  const encryptedPayload = await encryptionService.encryptJson(
    responseData,
    keyTier,
    coupleId,
    `prompt_response:${promptId}`
  );

  return {
    encryptedData: encryptedPayload,
    isEncrypted: true,
    encryptedAt: Date.now(),
    promptId,
  };
}

export async function savePromptResponse(userId, promptId, response, {
  isPrivate = false,
  fallbackCoupleId = null,
  dependencies = {},
} = {}) {
  if (!userId || !promptId || !response) return null;

  const { storageRouter } = getDependencies(dependencies);
  const responseRecord = await buildPromptResponseRecord(promptId, response, {
    isPrivate,
    fallbackCoupleId,
    dependencies,
  });
  const { coupleId } = await getPromptCoupleContext({ fallbackCoupleId, dependencies });
  await storageRouter.saveMemory(userId, responseRecord, coupleId);
  return responseRecord;
}

export async function loadPromptResponses(userId, {
  fallbackCoupleId = null,
  dependencies = {},
} = {}) {
  if (!userId) return [];

  const { encryptionService, storageRouter } = getDependencies(dependencies);
  const responses = await storageRouter.getUserMemories(userId);
  const { coupleId, keyTier } = await getPromptCoupleContext({ fallbackCoupleId, dependencies });

  return Promise.all(
    (responses || []).map(async (response) => {
      if (!response.isEncrypted) return response;

      try {
        const decrypted = await encryptionService.decryptJson(
          response.encryptedData,
          keyTier,
          coupleId
        );
        return decrypted ? { ...response, decryptedContent: decrypted } : response;
      } catch (error) {
        if (__DEV__) console.error('Error decrypting response:', error);
        return response;
      }
    })
  );
}

export default {
  getPromptCoupleContext,
  getSharedDailyPromptSelection,
  saveSharedDailyPromptSelection,
  buildPromptResponseRecord,
  savePromptResponse,
  loadPromptResponses,
};