const {
  resolvePromptAnswerDateKey,
  resolveVisibleDailyPromptState,
} = require('../../utils/dailyPromptState');

describe('dailyPromptState', () => {
  it('does not expose a stale daily prompt after the daily window changes', () => {
    const state = resolveVisibleDailyPromptState({
      id: 'today-1',
      text: 'Yesterday question',
      dateKey: '2026-05-05',
    }, '2026-05-06');

    expect(state).toEqual({
      prompt: null,
      dateKey: '2026-05-06',
      promptReady: false,
      isStale: true,
    });
  });

  it('keeps the current daily prompt visible when its date key matches', () => {
    const prompt = {
      id: 'today-1',
      text: 'Today question',
      dateKey: '2026-05-06',
    };

    expect(resolveVisibleDailyPromptState(prompt, '2026-05-06')).toEqual({
      prompt,
      dateKey: '2026-05-06',
      promptReady: true,
      isStale: false,
    });
  });

  it('uses the active daily window for Today Between Us answer routes', () => {
    expect(resolvePromptAnswerDateKey({
      id: 'daily-1',
      text: 'Old routed daily question',
      dateKey: '2026-05-05',
      dailyOnly: true,
    }, '2026-05-06')).toBe('2026-05-06');
  });

  it('preserves explicit date keys for non-daily prompt answer routes', () => {
    expect(resolvePromptAnswerDateKey({
      id: 'browse-1',
      text: 'Browse prompt',
      dateKey: '2026-05-05',
    }, '2026-05-06')).toBe('2026-05-05');
  });
});
