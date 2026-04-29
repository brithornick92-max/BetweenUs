const navigate = jest.fn();

const DeepLinkHandler = require('../../services/DeepLinkHandler').default;

beforeEach(() => {
  jest.clearAllMocks();
  DeepLinkHandler.setNavigationRef({
    isReady: () => true,
    navigate,
  });
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

  it('routes quiz URLs to Daily Quiz', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://quiz');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('CouplesQuiz', {});
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
