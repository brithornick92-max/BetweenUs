const navigate = jest.fn();

const DeepLinkHandler = require('../../services/DeepLinkHandler').default;

beforeEach(() => {
  jest.clearAllMocks();
  DeepLinkHandler.setNavigationRef({
    isReady: () => true,
    navigate,
  });
  DeepLinkHandler.setShowSecondaryTabs(true);
});

describe('DeepLinkHandler.handleUrl', () => {
  it('routes custom-scheme host URLs correctly', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://prompt/p-123');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('PromptAnswer', { promptId: 'p-123' });
  });

  it('routes path-style custom URLs correctly', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus:///prompt/prompt-123');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('PromptAnswer', { promptId: 'prompt-123' });
  });

  it('routes journal URLs to the journal home', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://journal');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('JournalHome', {});
  });

  it('routes pair URLs to the current partner connection screen', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://pair');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('ConnectPartner', {});
  });

  it('routes invite join URLs to the partner connection screen with the code', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://join/7K4P9M9X');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('ConnectPartner', { code: '7K4P9M9X' });
  });

  it('routes invite join URLs with a code query parameter', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://join?code=7K4P9M9X');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('ConnectPartner', { code: '7K4P9M9X' });
  });

  it('routes quiz URLs to Daily Quiz', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://quiz');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('CouplesQuiz', {});
  });

  it('routes date idea reminder URLs to the Dates tab', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://date-ideas');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('MainTabs', { screen: 'DatePlans' });
  });

  it('routes current Dates tab URLs to the Dates tab', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://dates');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('MainTabs', { screen: 'DatePlans' });
  });

  it('routes private inspiration URLs to Intimacy Positions', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://intimacy');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('IntimacyPositions', {});
  });

  it('keeps old saved-moments URLs routed to Keepsake', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://saved-moments');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('OurStory', {});
  });

  it('returns false for unknown routes', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://unknown/123');

    expect(handled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rejects prompt URLs with missing or unsafe ids', () => {
    expect(DeepLinkHandler.handleUrl('betweenus://prompt')).toBe(false);
    expect(DeepLinkHandler.handleUrl('betweenus://prompt/bad/id')).toBe(false);
    expect(DeepLinkHandler.handleUrl('betweenus://prompt/bad%2Fid')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes auth callback URLs through to the auth screen', () => {
    const url = 'betweenus://auth-callback#access_token=token';
    const handled = DeepLinkHandler.handleUrl(url);

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('AuthCallback', { url });
  });
});

describe('DeepLinkHandler.handleNotificationResponse', () => {
  it('routes notification taps to the expected screen', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              route: 'prompt',
              id: 'p-456',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('PromptAnswer', { promptId: 'p-456' });
  });

  it('routes URL-only notification taps from local notifications', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              url: 'betweenus://journal',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('JournalHome', {});
  });

  it('routes backend notifications with snake_case ids', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              route: 'prompt',
              prompt_id: 'h2_042',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('PromptAnswer', { promptId: 'h2_042' });
  });

  it('infers routes from notification activity types when route is absent', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              type: 'memory_saved',
              memory_id: 'mem-1',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('OurStory', {});
  });

  it('falls back to a safe URL when an external notification route is incomplete', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              route: 'prompt',
              url: 'betweenus://prompt/p-url-1',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('PromptAnswer', { promptId: 'p-url-1' });
  });

  it('routes saved-moments notification taps to Keepsake', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              route: 'saved-moments',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('OurStory', {});
  });

  it('rejects unsafe notification ids', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              route: 'prompt',
              promptId: 'bad/id',
            },
          },
        },
      },
    });

    // 'prompt' is an ID-required route — a sanitized-to-null ID means the
    // handler should refuse to navigate rather than pass null to the screen.
    expect(handled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns false for unknown notification routes', () => {
    const handled = DeepLinkHandler.handleNotificationResponse({
      notification: {
        request: {
          content: {
            data: {
              route: 'unknown',
            },
          },
        },
      },
    });

    expect(handled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
