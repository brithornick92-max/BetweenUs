const {
  canShowPartnerPromptQuote,
  choosePartnerPromptQuote,
} = require('../../utils/partnerPromptQuote');

describe('choosePartnerPromptQuote', () => {
  const now = new Date(2026, 3, 30);

  it('uses a random partner answer before the first year', () => {
    const quote = choosePartnerPromptQuote([
      {
        prompt_id: 'p1',
        date_key: '2026-02-14',
        partnerAnswer: 'I loved that walk.',
      },
      {
        prompt_id: 'p2',
        date_key: '2026-03-14',
        partnerAnswer: 'Your laugh.',
      },
    ], {
      now,
      relationshipStartDate: '2026-01-01',
      random: () => 0.6,
    });

    expect(quote.prompt_id).toBe('p2');
    expect(quote.answer).toBe('Your laugh.');
    expect(quote.isOnThisDay).toBe(false);
  });

  it('prefers a same month and day partner answer after a year', () => {
    const quote = choosePartnerPromptQuote([
      {
        prompt_id: 'p1',
        date_key: '2025-04-30',
        partnerAnswer: 'This day felt easy with you.',
      },
      {
        prompt_id: 'p2',
        date_key: '2026-03-14',
        partnerAnswer: 'Your laugh.',
      },
    ], {
      now,
      relationshipStartDate: '2025-01-01',
      random: () => 0.9,
    });

    expect(quote.prompt_id).toBe('p1');
    expect(quote.answer).toBe('This day felt easy with you.');
    expect(quote.isOnThisDay).toBe(true);
  });

  it('falls back to random after a year when there is no same-day answer', () => {
    const quote = choosePartnerPromptQuote([
      {
        prompt_id: 'p1',
        date_key: '2025-04-29',
        partnerAnswer: 'Almost the same day.',
      },
      {
        prompt_id: 'quiz:p2',
        date_key: '2025-04-30',
        partnerAnswer: 'Skip quiz answers.',
      },
    ], {
      now,
      relationshipStartDate: '2025-01-01',
      random: () => 0,
    });

    expect(quote.prompt_id).toBe('p1');
    expect(quote.isOnThisDay).toBe(false);
  });

  it('ignores empty partner answers and today rows', () => {
    const quote = choosePartnerPromptQuote([
      { prompt_id: 'p1', date_key: '2026-04-30', partnerAnswer: 'Today is excluded.' },
      { prompt_id: 'p2', date_key: '2026-04-01', partnerAnswer: '   ' },
    ], { now });

    expect(quote).toBeNull();
  });
});

describe('canShowPartnerPromptQuote', () => {
  const now = new Date(2026, 3, 30);

  it('requires at least 5 days and 5 answered prompts', () => {
    expect(canShowPartnerPromptQuote({
      now,
      firstOpenDate: '2026-04-25',
      answeredCount: 5,
    })).toBe(true);

    expect(canShowPartnerPromptQuote({
      now,
      firstOpenDate: '2026-04-26',
      answeredCount: 5,
    })).toBe(false);

    expect(canShowPartnerPromptQuote({
      now,
      firstOpenDate: '2026-04-25',
      answeredCount: 4,
    })).toBe(false);
  });

  it('stays hidden when first open date is missing', () => {
    expect(canShowPartnerPromptQuote({
      now,
      firstOpenDate: null,
      answeredCount: 20,
    })).toBe(false);
  });
});
