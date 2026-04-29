const {
  PROMPT_COMPLETION_HIDE_DAYS,
  getRecentlyCompletedPromptIds,
} = require('../../utils/promptHistory');

describe('promptHistory', () => {
  it('suppresses answered prompts for the configured cooldown window', () => {
    const now = new Date('2026-04-29T12:00:00.000Z').getTime();
    const recent = new Date(now - ((PROMPT_COMPLETION_HIDE_DAYS - 1) * 24 * 60 * 60 * 1000)).toISOString();
    const old = new Date(now - ((PROMPT_COMPLETION_HIDE_DAYS + 1) * 24 * 60 * 60 * 1000)).toISOString();

    const ids = getRecentlyCompletedPromptIds([
      { prompt_id: 'recent-prompt', answer: 'yes', created_at: recent },
      { prompt_id: 'old-prompt', answer: 'yes', created_at: old },
      { prompt_id: 'unanswered-prompt', answer: '', created_at: recent },
      { prompt_id: 'quiz:q001', answer: 'quiz answer', created_at: recent },
    ], now);

    expect(ids.has('recent-prompt')).toBe(true);
    expect(ids.has('old-prompt')).toBe(false);
    expect(ids.has('unanswered-prompt')).toBe(false);
    expect(ids.has('quiz:q001')).toBe(false);
  });

  it('supports date keys and camelCase prompt answer rows', () => {
    const now = new Date('2026-04-29T12:00:00.000Z').getTime();

    const ids = getRecentlyCompletedPromptIds([
      { promptId: 'camel-prompt', answer: 'yes', dateKey: '2026-04-28' },
    ], now);

    expect(ids.has('camel-prompt')).toBe(true);
  });
});
