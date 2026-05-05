const React = require('react');
const renderer = require('react-test-renderer');

const TODAY = new Date();
const TODAY_KEY = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;
const DAILY_PROMPT_CACHE_KEY = '@betweenus:cache:dailyPromptSelection';

const mockPromptCatalog = {
  blocked: { id: 'blocked', text: 'Blocked prompt', category: 'kinky', heat: 2 },
  allowed: { id: 'allowed', text: 'Allowed prompt', category: 'romance', heat: 2 },
};

let mockCurrentProfile = null;
let capturedContext = null;

const mockStorageGet = jest.fn();
const mockStorageSet = jest.fn();
const mockGetPrompts = jest.fn();
const mockLoadPromptResponses = jest.fn();
const mockGetPromptAnswers = jest.fn();
const mockUpdateWidgetPrompt = jest.fn();
const mockSetDailyPromptId = jest.fn();
const mockGetUserUsageStatus = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1' },
    userProfile: { id: 'profile-1', heatLevelPreference: 5 },
    updateProfile: jest.fn(),
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
    const hiddenCategories = profile?.boundaries?.hiddenCategories || [];
    const pausedEntries = profile?.boundaries?.pausedEntries || [];

    return (items || []).filter((item) => {
      if (!item) return false;
      if ((item.heat || 1) > maxHeat) return false;
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
}));

jest.mock('../../utils/promptHistory', () => ({
  getRecentlyCompletedPromptIds: jest.fn(() => new Set()),
}));

jest.mock('../../utils/freeWeeklyDeckAccess', () => ({
  filterItemsToFreeWeeklyDeck: jest.fn((items) => items),
}));

jest.mock('../../utils/storage', () => ({
  STORAGE_KEYS: {
    CONTENT_DECK_RESTORES: 'contentDeckRestores',
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

describe('ContentContext daily prompt boundary refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedContext = null;
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
    mockUpdateWidgetPrompt.mockResolvedValue(true);
    mockStorageSet.mockResolvedValue(true);
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

  it('replaces a cached daily prompt when new boundaries hide it', async () => {
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

    expect(refreshedPrompt.id).toBe('allowed');
    expect(mockStorageSet).toHaveBeenLastCalledWith(
      DAILY_PROMPT_CACHE_KEY,
      expect.objectContaining({
        dateKey: TODAY_KEY,
        scope: 'user:user-1',
        promptId: 'allowed',
      })
    );

    tree.unmount();
  });
});
