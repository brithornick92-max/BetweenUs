describe('ContentCoupleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createDeps({ coupleId = 'couple-1' } = {}) {
    return {
      encryptionService: {
        encryptJson: jest.fn().mockResolvedValue('encrypted-payload'),
        decryptJson: jest.fn().mockResolvedValue({ content: 'decrypted response' }),
      },
      storageRouter: {
        saveMemory: jest.fn().mockResolvedValue({ id: 'memory-1' }),
        getUserMemories: jest.fn().mockResolvedValue([
          { id: 'memory-1', isEncrypted: true, encryptedData: 'encrypted-payload' },
          { id: 'memory-2', isEncrypted: false, content: 'plain' },
        ]),
      },
      coupleStateService: {
        getActiveCoupleId: jest.fn().mockResolvedValue(coupleId),
        getSharedDailyPromptSelection: jest.fn().mockResolvedValue({ value: { promptId: 'prompt-1' } }),
        saveSharedDailyPromptSelection: jest.fn().mockResolvedValue(true),
      },
    };
  }

  it('builds and saves encrypted prompt responses using the couple tier when linked', async () => {
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
      encryptedData: 'encrypted-payload',
      isEncrypted: true,
      promptId: 'prompt-1',
    }));
    expect(deps.encryptionService.encryptJson).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'hello', promptId: 'prompt-1' }),
      'couple',
      'couple-1',
      'prompt_response:prompt-1'
    );

    await savePromptResponse('user-1', 'prompt-1', 'hello', {
      fallbackCoupleId: 'profile-couple-id',
      dependencies: deps,
    });

    expect(deps.storageRouter.saveMemory).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ encryptedData: 'encrypted-payload', promptId: 'prompt-1' }),
      'couple-1'
    );
  });

  it('loads and decrypts prompt responses using the resolved tier', async () => {
    const { loadPromptResponses } = require('../../services/content/ContentCoupleService');
    const deps = createDeps();

    const responses = await loadPromptResponses('user-1', {
      fallbackCoupleId: 'profile-couple-id',
      dependencies: deps,
    });

    expect(deps.storageRouter.getUserMemories).toHaveBeenCalledWith('user-1');
    expect(deps.encryptionService.decryptJson).toHaveBeenCalledWith(
      'encrypted-payload',
      'couple',
      'couple-1'
    );
    expect(responses[0]).toEqual(expect.objectContaining({
      decryptedContent: { content: 'decrypted response' },
    }));
    expect(responses[1]).toEqual(expect.objectContaining({ id: 'memory-2', content: 'plain' }));
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