describe('ContentCoupleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createDeps({ coupleId = 'couple-1' } = {}) {
    return {
      storageRouter: {
        saveMemory: jest.fn().mockResolvedValue({ id: 'memory-1' }),
      },
      dataLayer: {
        savePromptAnswer: jest.fn().mockResolvedValue({ id: 'answer-1', prompt_id: 'prompt-1', answer: 'hello' }),
        getPromptAnswers: jest.fn().mockResolvedValue([
          { id: 'answer-1', prompt_id: 'prompt-1', answer: 'hello' },
          { id: 'answer-2', prompt_id: 'prompt-2', answer: 'plain' },
        ]),
      },
      coupleStateService: {
        getActiveCoupleId: jest.fn().mockResolvedValue(coupleId),
        getSharedDailyPromptSelection: jest.fn().mockResolvedValue({ value: { promptId: 'prompt-1' } }),
        saveSharedDailyPromptSelection: jest.fn().mockResolvedValue(true),
      },
    };
  }

   it('builds and saves plain prompt responses using the cloud data layer', async () => {
    const {
      buildPromptResponseRecord,
      savePromptResponse,
    } = require('../../services/content/ContentCoupleService');
    const deps = createDeps();

    const record = await buildPromptResponseRecord('prompt-1', 'hello', {
      fallbackCoupleId: 'profile-couple-id',
      dependencies: deps,
    });

    expect(record).toEqual(expect.objectContaining({
      content: 'hello',
      promptId: 'prompt-1',
      isPrivate: false,
    }));

    await savePromptResponse('user-1', 'prompt-1', 'hello', {
      fallbackCoupleId: 'profile-couple-id',
      dependencies: deps,
    });

    expect(deps.dataLayer.savePromptAnswer).toHaveBeenCalledWith({
      promptId: 'prompt-1',
      answer: 'hello',
    });
  });

  it('loads prompt responses from the cloud data layer', async () => {
    const { loadPromptResponses } = require('../../services/content/ContentCoupleService');
    const deps = createDeps();

    const responses = await loadPromptResponses('user-1', {
      fallbackCoupleId: 'profile-couple-id',
      dependencies: deps,
    });

    expect(deps.dataLayer.getPromptAnswers).toHaveBeenCalledWith({ limit: 365 });
    expect(responses[0]).toEqual(expect.objectContaining({ id: 'answer-1', answer: 'hello' }));
    expect(responses[1]).toEqual(expect.objectContaining({ id: 'answer-2', answer: 'plain' }));
  });

  it('delegates shared daily prompt access through the content service boundary', async () => {
    const {
      getSharedDailyPromptSelection,
      saveSharedDailyPromptSelection,
    } = require('../../services/content/ContentCoupleService');
    const deps = createDeps();

    await expect(getSharedDailyPromptSelection('2026-04-20', {
      dependencies: deps,
    })).resolves.toEqual({ value: { promptId: 'prompt-1' } });

    await expect(saveSharedDailyPromptSelection('2026-04-20', 'prompt-2', 'user-1', {
      dependencies: deps,
    })).resolves.toBe(true);

    expect(deps.coupleStateService.getSharedDailyPromptSelection).toHaveBeenCalledWith('2026-04-20', expect.any(Object));
    expect(deps.coupleStateService.saveSharedDailyPromptSelection).toHaveBeenCalledWith('2026-04-20', 'prompt-2', 'user-1', expect.any(Object));
  });
});