const React = require('react');
const renderer = require('react-test-renderer');
const { getDailyContentDateKey } = require('../../utils/dailyContentDate');
const { getNoRepeatRotationItem } = require('../../utils/noRepeatContentRotation');

const TODAY_KEY = getDailyContentDateKey();
const DAILY_PROMPT_CACHE_KEY = '@betweenus:cache:dailyPromptSelection';

const mockPromptCatalog = {
  blocked: { id: 'blocked', text: 'Blocked prompt', category: 'kinky', heat: 2 },
  allowed: { id: 'allowed', text: 'Allowed prompt', category: 'romance', heat: 2 },
  stale: { id: 'stale', text: 'Stale local prompt', category: 'romance', heat: 1 },
};

let mockCurrentProfile = null;
let mockRecentlyCompletedPromptIds = new Set();
let capturedContext = null;

const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockGetPrompts = jest.fn();
const mockLoadPromptResponses = jest.fn();
const mockGetPromptAnswers = jest.fn();
const mockUpdateProfile = jest.fn();
const mockUpdateWidgetPrompt = jest.fn();
const mockSetDailyPromptId = jest.fn();
const mockGetUserUsageStatus = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
    userProfile: { id: 'profile-1', heatLevelPreference: 5 },
    updateProfile: (...args) => mockUpdateProfile(...args),
  }),
}));

jest.mock('../../context/EntitlementsContext', () => ({
  useEntitlements: () => ({
    isPremiumEffective: true,
  }),
}));

jest.mock('../../services/storage/StorageRouter', () => ({
  __esModule: true,
  default: {
    getPrompts: (...args) => mockGetPrompts(...args),
    getDates: jest.fn().mockResolvedValue([]),
    setSupabaseSession: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../services/PremiumGatekeeper', () => ({
  __esModule: true,
  default: {
    canAccessPrompt: jest.fn().mockResolvedValue({ canAccess: true }),
    canAccessDate: jest.fn().mockResolvedValue({ canAccess: true }),
    getUserUsageStatus: (...args) => mockGetUserUsageStatus(...args),
    trackPromptUsage: jest.fn().mockResolvedValue({ success: true }),
    trackDateUsage: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../services/ContentAccessService', () => ({
  __esModule: true,
  default: {
    getAllowedHeatLevels: jest.fn((isPremium, profile) => {
      if (Array.isArray(profile?.allowedHeatLevels)) return profile.allowedHeatLevels;
      const maxHeat = typeof profile?.maxHeat === 'number'
        ? profile.maxHeat
        : typeof profile?.heatLevelPreference === 'number'
          ? profile.heatLevelPreference
          : 5;
      return [1, 2, 3, 4, 5].filter((level) => level <= maxHeat);
    }),
    getUserMaxHeatLevel: jest.fn((profile) => {
      if (typeof profile?.maxHeat === 'number') return profile.maxHeat;
      if (typeof profile?.heatLevelPreference === 'number') return profile.heatLevelPreference;
      return 5;
    }),
  },
}));

jest.mock('../../services/widgetData', () => ({
  updateWidgetPrompt: (...args) => mockUpdateWidgetPrompt(...args),
}));

jest.mock('../../services/supabase/SupabaseAuthService', () => ({
  SupabaseAuthService: {
    getSession: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../services/PreferenceEngine', () => ({
  getContentProfile: jest.fn(async () => mockCurrentProfile),
  filterPrompts: jest.fn((items, profile) => {
    const maxHeat = profile?.maxHeat ?? 5;
    const allowedHeatLevels = Array.isArray(profile?.allowedHeatLevels) ? profile.allowedHeatLevels : null;
    const hiddenCategories = profile?.boundaries?.hiddenCategories || [];
    const pausedEntries = profile?.boundaries?.pausedEntries || [];

    return (items || []).filter((item) => {
      if (!item) return false;
      if ((item.heat || 1) > maxHeat) return false;
      if (allowedHeatLevels && !allowedHeatLevels.includes(item.heat || 1)) return false;
      if (hiddenCategories.includes(item.category)) return false;
      if (pausedEntries.includes(item.id)) return false;
      return true;
    });
  }),
  warmRatingsCache: jest.fn(),
}));

jest.mock('../../services/PolishEngine', () => ({
  NicknameEngine: {
    personalize: jest.fn(async (text) => text),
  },
  SoftBoundaries: {
    shouldShowPrompt: jest.fn(async (prompt) => prompt?.category !== 'kinky'),
  },
}));

jest.mock('../../services/couple/CoupleStateService', () => ({
  clearPendingSharedAnniversary: jest.fn(),
  getActiveCoupleId: jest.fn().mockResolvedValue(null),
  getPendingSharedAnniversary: jest.fn().mockResolvedValue(null),
  getSharedAnniversary: jest.fn().mockResolvedValue(null),
  setPendingSharedAnniversary: jest.fn(),
  subscribeToSharedAnniversary: jest.fn().mockResolvedValue(() => {}),
  syncSharedAnniversary: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/content/ContentCoupleService', () => ({
  getSharedDailyPromptSelection: jest.fn().mockResolvedValue(null),
  loadPromptResponses: (...args) => mockLoadPromptResponses(...args),
  savePromptResponse: jest.fn().mockResolvedValue(true),
  saveSharedDailyPromptSelection: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../services/localfirst', () => ({
  DataLayer: {
    getPromptAnswers: (...args) => mockGetPromptAnswers(...args),
  },
}));

jest.mock('../../utils/contentLoader', () => ({
  FALLBACK_PROMPT: { id: 'fallback', text: 'Fallback prompt', category: 'romance', heat: 1 },
  getPromptById: jest.fn((id) => mockPromptCatalog[id] || null),
  getTodayBetweenUsPrompts: jest.fn(() => [
    mockPromptCatalog.blocked,
    mockPromptCatalog.allowed,
  ]),
}));

jest.mock('../../utils/promptHistory', () => ({
  getRecentlyCompletedPromptIds: jest.fn(() => mockRecentlyCompletedPromptIds),
}));

jest.mock('../../utils/stableWeeklyContent', () => ({
  buildStableWeeklySet: jest.fn(async (items) => ({ items })),
}));

jest.mock('../../utils/storage', () => ({
  STORAGE_KEYS: {
    CONTENT_DECK_RESTORES: 'contentDeckRestores',
    WEEKLY_CONTENT_ALLOCATIONS: 'weeklyContentAllocations',
  },
  storage: {
    get: (...args) => mockStorageGet(...args),
    set: (...args) => mockStorageSet(...args),
    remove: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../services/PromptAllocator', () => ({
  __esModule: true,
  default: {
    load: jest.fn().mockResolvedValue(true),
    reset: jest.fn(),
    setDailyPromptId: (...args) => mockSetDailyPromptId(...args),
    recordAnswer: jest.fn(),
  },
}));

function Probe() {
  const { useContent } = require('../../context/ContentContext');
  capturedContext = useContent();
  return null;
}

async function mountProvider() {
  const { ContentProvider } = require('../../context/ContentContext');
  let tree;

  await renderer.act(async () => {
    tree = renderer.create(
      React.createElement(ContentProvider, null, React.createElement(Probe))
    );
  });

  return tree;
}

function expectedPromptIdForScope(dateKey, scope) {
  const promptPool = [mockPromptCatalog.allowed, mockPromptCatalog.blocked]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return getNoRepeatRotationItem(promptPool, dateKey, {
    seed: `${scope}:today-between-us`,
  }).id;
}

function expectedCouplePromptId(dateKey, coupleId) {
  return expectedPromptIdForScope(dateKey, `couple:${coupleId}`);
}

describe('ContentContext daily prompt stability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedContext = null;
    const coupleStateService = require('../../services/couple/CoupleStateService');
    const contentCoupleService = require('../../services/content/ContentCoupleService');

    coupleStateService.getActiveCoupleId.mockResolvedValue(null);
    contentCoupleService.getSharedDailyPromptSelection.mockResolvedValue(null);
    contentCoupleService.saveSharedDailyPromptSelection.mockResolvedValue(true);
    mockCurrentProfile = {
      heatLevelPreference: 5,
      maxHeat: 5,
      boundaries: {
        hideSpicy: false,
        hiddenCategories: [],
        pausedEntries: [],
        pausedDates: [],
        maxHeatOverride: null,
      },
    };

    mockGetPrompts.mockResolvedValue([
      mockPromptCatalog.blocked,
      mockPromptCatalog.allowed,
    ]);
    mockLoadPromptResponses.mockResolvedValue([]);
    mockGetPromptAnswers.mockResolvedValue([]);
    mockGetUserUsageStatus.mockResolvedValue(null);
    mockUpdateProfile.mockResolvedValue(true);
    mockUpdateWidgetPrompt.mockResolvedValue(true);
    mockStorageSet.mockResolvedValue(true);
    mockRecentlyCompletedPromptIds = new Set();
    mockStorageGet.mockImplementation(async (key) => {
      if (key === DAILY_PROMPT_CACHE_KEY) {
        return {
          dateKey: TODAY_KEY,
          scope: 'user:user-1',
          promptId: 'blocked',
        };
      }
      if (key === 'contentDeckRestores') {
        return {
          prompts: [],
          dates: [],
          positions: [],
        };
      }
      return null;
    });
  });

  it('keeps a cached daily prompt fixed for the 4am app day even when boundaries change', async () => {
    const tree = await mountProvider();

    let firstPrompt;
    await renderer.act(async () => {
      firstPrompt = await capturedContext.loadTodayPrompt();
    });

    expect(firstPrompt.id).toBe('blocked');

    mockCurrentProfile = {
      ...mockCurrentProfile,
      boundaries: {
        ...mockCurrentProfile.boundaries,
        hiddenCategories: ['kinky'],
      },
    };

    let refreshedPrompt;
    await renderer.act(async () => {
      refreshedPrompt = await capturedContext.loadTodayPrompt();
    });

    expect(refreshedPrompt.id).toBe('blocked');
    expect(mockGetPrompts).not.toHaveBeenCalled();
    expect(mockStorageSet).not.toHaveBeenCalled();

    tree.unmount();
  });

  it('keeps a cached prompt fixed for the day after it has been answered', async () => {
    const tree = await mountProvider();

    let firstPrompt;
    await renderer.act(async () => {
      firstPrompt = await capturedContext.loadTodayPrompt();
    });

    expect(firstPrompt.id).toBe('blocked');
    tree.unmount();

    mockRecentlyCompletedPromptIds = new Set(['blocked']);
    const remountedTree = await mountProvider();

    let cachedPrompt;
    await renderer.act(async () => {
      cachedPrompt = await capturedContext.loadTodayPrompt();
    });

    expect(cachedPrompt.id).toBe('blocked');
    expect(mockStorageSet).not.toHaveBeenCalled();

    remountedTree.unmount();
  });

  it('uses the shared couple prompt before a stale linked local cache', async () => {
    const coupleStateService = require('../../services/couple/CoupleStateService');
    const contentCoupleService = require('../../services/content/ContentCoupleService');

    coupleStateService.getActiveCoupleId.mockResolvedValue('couple-1');
    contentCoupleService.getSharedDailyPromptSelection.mockResolvedValue({
      value: { promptId: 'allowed' },
    });
    mockStorageGet.mockImplementation(async (key) => {
      if (key === DAILY_PROMPT_CACHE_KEY) {
        return {
          dateKey: TODAY_KEY,
          scope: 'couple:couple-1',
          promptId: 'blocked',
        };
      }
      if (key === 'contentDeckRestores') {
        return {
          prompts: [],
          dates: [],
          positions: [],
        };
      }
      return null;
    });

    const tree = await mountProvider();

    let prompt;
    await renderer.act(async () => {
      prompt = await capturedContext.loadTodayPrompt();
    });

    expect(prompt.id).toBe('allowed');
    expect(contentCoupleService.getSharedDailyPromptSelection).toHaveBeenCalledWith(
      TODAY_KEY,
      expect.objectContaining({ fallbackCoupleId: 'couple-1' })
    );
    expect(mockStorageSet).toHaveBeenCalledWith(
      DAILY_PROMPT_CACHE_KEY,
      {
        dateKey: TODAY_KEY,
        scope: 'couple:couple-1',
        promptId: 'allowed',
      }
    );

    tree.unmount();
  });

  it('uses same-day couple cache as the display backup when shared cloud selection is unavailable', async () => {
    const coupleStateService = require('../../services/couple/CoupleStateService');
    const contentCoupleService = require('../../services/content/ContentCoupleService');

    coupleStateService.getActiveCoupleId.mockResolvedValue('couple-1');
    contentCoupleService.getSharedDailyPromptSelection.mockResolvedValue(null);
    mockStorageGet.mockImplementation(async (key) => {
      if (key === DAILY_PROMPT_CACHE_KEY) {
        return {
          dateKey: TODAY_KEY,
          scope: 'couple:couple-1',
          promptId: 'allowed',
        };
      }
      if (key === 'contentDeckRestores') {
        return {
          prompts: [],
          dates: [],
          positions: [],
        };
      }
      return null;
    });

    const tree = await mountProvider();

    let prompt;
    await renderer.act(async () => {
      prompt = await capturedContext.loadTodayPrompt();
    });

    expect(prompt.id).toBe('allowed');
    expect(contentCoupleService.saveSharedDailyPromptSelection).toHaveBeenCalledWith(
      TODAY_KEY,
      'allowed',
      'user-1',
      expect.objectContaining({ fallbackCoupleId: 'couple-1' })
    );
    expect(mockStorageSet).toHaveBeenCalledWith(
      DAILY_PROMPT_CACHE_KEY,
      {
        dateKey: TODAY_KEY,
        scope: 'couple:couple-1',
        promptId: 'allowed',
      }
    );

    tree.unmount();
  });

  it('uses one deterministic couple prompt when no shared or cached selection exists', async () => {
    const coupleStateService = require('../../services/couple/CoupleStateService');
    const contentCoupleService = require('../../services/content/ContentCoupleService');
    const expectedPromptId = expectedCouplePromptId(TODAY_KEY, 'couple-1');

    coupleStateService.getActiveCoupleId.mockResolvedValue('couple-1');
    contentCoupleService.getSharedDailyPromptSelection.mockResolvedValue(null);
    mockCurrentProfile = {
      ...mockCurrentProfile,
      boundaries: {
        ...mockCurrentProfile.boundaries,
        hiddenCategories: ['kinky'],
      },
    };
    mockStorageGet.mockImplementation(async (key) => {
      if (key === DAILY_PROMPT_CACHE_KEY) {
        return null;
      }
      if (key === 'contentDeckRestores') {
        return {
          prompts: [],
          dates: [],
          positions: [],
        };
      }
      return null;
    });

    const tree = await mountProvider();

    let prompt;
    await renderer.act(async () => {
      prompt = await capturedContext.loadTodayPrompt();
    });

    expect(prompt.id).toBe(expectedPromptId);
    expect(prompt.id).not.toBe('stale');
    expect(contentCoupleService.saveSharedDailyPromptSelection).toHaveBeenCalledWith(
      TODAY_KEY,
      expectedPromptId,
      'user-1',
      expect.objectContaining({ fallbackCoupleId: 'couple-1' })
    );
    expect(mockStorageSet).toHaveBeenCalledWith(
      DAILY_PROMPT_CACHE_KEY,
      {
        dateKey: TODAY_KEY,
        scope: 'couple:couple-1',
        promptId: expectedPromptId,
      }
    );

    tree.unmount();
  });

  it('re-reads the shared couple prompt after saving so the first cloud writer wins', async () => {
    const coupleStateService = require('../../services/couple/CoupleStateService');
    const contentCoupleService = require('../../services/content/ContentCoupleService');
    const localPromptId = expectedCouplePromptId(TODAY_KEY, 'couple-1');
    const winningPromptId = localPromptId === 'allowed' ? 'blocked' : 'allowed';

    coupleStateService.getActiveCoupleId.mockResolvedValue('couple-1');
    contentCoupleService.getSharedDailyPromptSelection
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: { promptId: winningPromptId } });
    contentCoupleService.saveSharedDailyPromptSelection.mockResolvedValue(true);
    mockStorageGet.mockImplementation(async (key) => {
      if (key === DAILY_PROMPT_CACHE_KEY) {
        return null;
      }
      if (key === 'contentDeckRestores') {
        return {
          prompts: [],
          dates: [],
          positions: [],
        };
      }
      return null;
    });

    const tree = await mountProvider();

    let prompt;
    await renderer.act(async () => {
      prompt = await capturedContext.loadTodayPrompt();
    });

    expect(prompt.id).toBe(winningPromptId);
    expect(contentCoupleService.saveSharedDailyPromptSelection).toHaveBeenCalledWith(
      TODAY_KEY,
      localPromptId,
      'user-1',
      expect.objectContaining({ fallbackCoupleId: 'couple-1' })
    );
    expect(contentCoupleService.getSharedDailyPromptSelection).toHaveBeenCalledTimes(2);
    expect(mockStorageSet).toHaveBeenCalledWith(
      DAILY_PROMPT_CACHE_KEY,
      {
        dateKey: TODAY_KEY,
        scope: 'couple:couple-1',
        promptId: winningPromptId,
      }
    );

    tree.unmount();
  });

  it('uses deterministic emergency daily fallback instead of the static fallback after scope resolves', async () => {
    const PremiumGatekeeper = require('../../services/PremiumGatekeeper').default;
    const expectedPromptId = expectedPromptIdForScope(TODAY_KEY, 'user:user-1');

    PremiumGatekeeper.canAccessPrompt.mockResolvedValueOnce({
      canAccess: false,
      message: 'Unable to verify access. Please try again.',
    });
    mockStorageGet.mockImplementation(async (key) => {
      if (key === DAILY_PROMPT_CACHE_KEY) return null;
      if (key === 'contentDeckRestores') {
        return {
          prompts: [],
          dates: [],
          positions: [],
        };
      }
      return null;
    });

    const tree = await mountProvider();

    let prompt;
    await renderer.act(async () => {
      prompt = await capturedContext.loadTodayPrompt();
    });

    expect(prompt.id).toBe(expectedPromptId);
    expect(prompt.id).not.toBe('fallback');
    expect(mockSetDailyPromptId).toHaveBeenCalledWith(expectedPromptId);

    tree.unmount();
  });

  it('rejects future relationship start dates before saving profile state', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 6, 12, 0));
    const tree = await mountProvider();

    try {
      await expect(
        capturedContext.updateRelationshipStartDate(new Date(2026, 4, 7, 12, 0))
      ).rejects.toThrow('Anniversary date cannot be in the future');

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    } finally {
      tree.unmount();
      jest.useRealTimers();
    }
  });
});
