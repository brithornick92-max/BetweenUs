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
    const handled = DeepLinkHandler.handleUrl('betweenus://love-note/note-123');

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('LoveNoteDetail', { noteId: 'note-123' });
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
              route: 'love-note',
              noteId: 'note-456',
            },
          },
        },
      },
    });

    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith('LoveNoteDetail', { noteId: 'note-456' });
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
