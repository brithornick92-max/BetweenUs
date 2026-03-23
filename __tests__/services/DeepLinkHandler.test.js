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

  it('returns false for unknown routes', () => {
    const handled = DeepLinkHandler.handleUrl('betweenus://unknown/123');

    expect(handled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});