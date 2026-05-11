describe('CoupleStateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createDeps({
    coupleId = 'couple-1',
    sharedPromptSelection = null,
    sharedQuizSelection = null,
    sharedAnniversary = null,
  } = {}) {
    return {
      storageApi: {
        get: jest.fn().mockImplementation((key, fallback) => {
          if (key === '@betweenus:cache:coupleId') return Promise.resolve(coupleId);
          if (key === '@betweenus:cache:pendingSharedAnniversaryDate') return Promise.resolve(null);
          return Promise.resolve(fallback ?? null);
        }),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
      storageRouter: {
        getCoupleData: jest.fn().mockImplementation((_coupleId, key) => {
          if (key === 'relationship_start_date') return Promise.resolve(sharedAnniversary);
          if (key.startsWith('daily_quiz_')) return Promise.resolve(sharedQuizSelection);
          return Promise.resolve(sharedPromptSelection);
        }),
        upsertCoupleData: jest.fn().mockResolvedValue(true),
      },
    };
  }

  it('prefers the verified fallback couple id over stale storage', async () => {
    const { getActiveCoupleId } = require('../../services/couple/CoupleStateService');

    await expect(getActiveCoupleId({
      fallbackCoupleId: 'profile-couple-id',
      dependencies: createDeps({ coupleId: 'stored-couple-id' }),
    })).resolves.toBe('profile-couple-id');

    await expect(getActiveCoupleId({
      fallbackCoupleId: 'profile-couple-id',
      dependencies: createDeps({ coupleId: null }),
    })).resolves.toBe('profile-couple-id');
  });

  it('can disable stored couple id fallback for shared assignment reads', async () => {
    const {
      getActiveCoupleId,
      getSharedDailyPromptSelection,
      subscribeToSharedAnniversary,
    } = require('../../services/couple/CoupleStateService');
    const deps = createDeps({ coupleId: 'stale-couple-id' });
    const ensureSession = jest.fn().mockResolvedValue({ access_token: 'token' });

    await expect(getActiveCoupleId({
      allowStoredFallback: false,
      dependencies: deps,
    })).resolves.toBeNull();

    await expect(getSharedDailyPromptSelection('2026-04-20', {
      allowStoredFallback: false,
      dependencies: deps,
    })).resolves.toBeNull();

    await expect(subscribeToSharedAnniversary({
      userId: 'user-1',
      allowStoredFallback: false,
      ensureSession,
      normalizeRelationshipStartDate: (value) => value,
      onRemoteUpdate: jest.fn(),
      dependencies: deps,
    })).resolves.toBeNull();

    expect(deps.storageRouter.getCoupleData).not.toHaveBeenCalled();
    expect(ensureSession).not.toHaveBeenCalled();
  });

  it('reads and writes shared daily prompt selections through one service boundary', async () => {
    const {
      getSharedDailyPromptSelection,
      saveSharedDailyPromptSelection,
    } = require('../../services/couple/CoupleStateService');
    const deps = createDeps({
      sharedPromptSelection: { value: { promptId: 'prompt-1' } },
    });
    const ensureSession = jest.fn().mockResolvedValue({ access_token: 'token' });

    await expect(getSharedDailyPromptSelection('2026-04-20', {
      ensureSession,
      dependencies: deps,
    })).resolves.toEqual({ value: { promptId: 'prompt-1' } });

    await expect(saveSharedDailyPromptSelection('2026-04-20', 'prompt-2', 'user-1', {
      ensureSession,
      dependencies: deps,
    })).resolves.toBe(true);

    expect(deps.storageRouter.getCoupleData).toHaveBeenCalledWith('couple-1', 'daily_prompt_2026-04-20');
    expect(deps.storageRouter.upsertCoupleData).toHaveBeenCalledWith(
      'couple-1',
      'daily_prompt_2026-04-20',
      { promptId: 'prompt-2', dateKey: '2026-04-20' },
      'user-1',
      false,
      'couple_state',
      { preserveOnDuplicate: true }
    );
  });

  it('reads and writes shared Daily Quiz question selections through one service boundary', async () => {
    const {
      getSharedDailyQuizQuestionSelection,
      saveSharedDailyQuizQuestionSelection,
    } = require('../../services/couple/CoupleStateService');
    const deps = createDeps({
      sharedQuizSelection: { value: { questionId: 'q123' } },
    });
    const ensureSession = jest.fn().mockResolvedValue({ access_token: 'token' });

    await expect(getSharedDailyQuizQuestionSelection('2026-04-20', {
      ensureSession,
      dependencies: deps,
    })).resolves.toEqual({ value: { questionId: 'q123' } });

    await expect(saveSharedDailyQuizQuestionSelection('2026-04-20', 'q124', 'user-1', {
      ensureSession,
      dependencies: deps,
    })).resolves.toBe(true);

    expect(deps.storageRouter.getCoupleData).toHaveBeenCalledWith('couple-1', 'daily_quiz_2026-04-20');
    expect(deps.storageRouter.upsertCoupleData).toHaveBeenCalledWith(
      'couple-1',
      'daily_quiz_2026-04-20',
      { questionId: 'q124', dateKey: '2026-04-20' },
      'user-1',
      false,
      'couple_state',
      { preserveOnDuplicate: true }
    );
  });

  it('reads and writes shared anniversary state through one service boundary', async () => {
    const {
      getSharedAnniversary,
      syncSharedAnniversary,
      setPendingSharedAnniversary,
      clearPendingSharedAnniversary,
    } = require('../../services/couple/CoupleStateService');
    const deps = createDeps({
      sharedAnniversary: { value: { startDate: '2024-01-01T00:00:00.000Z' } },
    });
    const ensureSession = jest.fn().mockResolvedValue({ access_token: 'token' });

    await expect(getSharedAnniversary({
      ensureSession,
      dependencies: deps,
    })).resolves.toEqual({ value: { startDate: '2024-01-01T00:00:00.000Z' } });

    await expect(syncSharedAnniversary('2024-01-01T00:00:00.000Z', 'user-1', {
      ensureSession,
      dependencies: deps,
    })).resolves.toBe(true);

    await setPendingSharedAnniversary('2024-01-01T00:00:00.000Z', deps);
    await clearPendingSharedAnniversary(deps);

    expect(deps.storageRouter.upsertCoupleData).toHaveBeenCalledWith(
      'couple-1',
      'relationship_start_date',
      { startDate: '2024-01-01T00:00:00.000Z' },
      'user-1',
      false,
      'couple_state'
    );
    expect(deps.storageApi.set).toHaveBeenCalledWith('@betweenus:cache:pendingSharedAnniversaryDate', '2024-01-01T00:00:00.000Z');
    expect(deps.storageApi.remove).toHaveBeenCalledWith('@betweenus:cache:pendingSharedAnniversaryDate');
  });
});
