import StorageRouter from '../storage/StorageRouter';
import CoupleStateService from '../couple/CoupleStateService';

function getDefaultDataLayer() {
  const localfirst = require('../localfirst');
  return localfirst.DataLayer;
}

function getDependencies(dependencies = {}) {
  return {
    storageRouter: dependencies.storageRouter ?? StorageRouter,
    coupleStateService: dependencies.coupleStateService ?? CoupleStateService,
    dataLayer: dependencies.dataLayer ?? getDefaultDataLayer(),
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
  return {
    content: response,
    promptId,
    isPrivate: false,
    savedAt: Date.now(),
  };
}

export async function savePromptResponse(userId, promptId, response, {
  isPrivate = false,
  fallbackCoupleId = null,
  dependencies = {},
} = {}) {
  if (!userId || !promptId || !response) return null;

  const { dataLayer } = getDependencies(dependencies);
  const responseRecord = await buildPromptResponseRecord(promptId, response, {
    isPrivate,
    fallbackCoupleId,
    dependencies,
  });

  return dataLayer.savePromptAnswer({
    promptId,
    answer: responseRecord.content,
  });
}

export async function loadPromptResponses(userId, {
  fallbackCoupleId = null,
  dependencies = {},
} = {}) {
  if (!userId) return [];

  const { dataLayer } = getDependencies(dependencies);
  if (typeof dataLayer.getSharedPromptAnswers === 'function') {
    return dataLayer.getSharedPromptAnswers({ limit: 365 });
  }

  return dataLayer.getPromptAnswers({ limit: 365 });
}

export default {
  getPromptCoupleContext,
  getSharedDailyPromptSelection,
  saveSharedDailyPromptSelection,
  buildPromptResponseRecord,
  savePromptResponse,
  loadPromptResponses,
};
