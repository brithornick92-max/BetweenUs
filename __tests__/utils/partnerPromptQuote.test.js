const {
  canShowPartnerPromptQuote,
  chooseDailyPartnerPromptQuote,
  choosePartnerPromptQuote,
  getPartnerPromptQuoteCandidateCount,
} = require('../../utils/partnerPromptQuote');
const AsyncStorage = require('@react-native-async-storage/async-storage');

function installStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));

  AsyncStorage.getItem.mockImplementation(async (key) => store.get(key) ?? null);
  AsyncStorage.setItem.mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  AsyncStorage.removeItem.mockImplementation(async (key) => {
    store.delete(key);
  });

  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  installStorageMock();
});

describe('choosePartnerPromptQuote', () => {
  const now = new Date(2026, 3, 30, 12);

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

  it('treats the previous calendar day as today before 4am', () => {
    const quote = choosePartnerPromptQuote([
      { prompt_id: 'p1', date_key: '2026-04-30', partnerAnswer: 'Still today before 4am.' },
      { prompt_id: 'p2', date_key: '2026-04-29', partnerAnswer: 'Past answer.' },
    ], {
      now: new Date(2026, 4, 1, 3, 30),
      relationshipStartDate: '2026-01-01',
      random: () => 0,
    });

    expect(quote.prompt_id).toBe('p2');
  });
});

describe('canShowPartnerPromptQuote', () => {
  const now = new Date(2026, 3, 30, 12);

  it('unlocks after enough eligible partner answers', () => {
    expect(canShowPartnerPromptQuote({
      now,
      answeredCount: 5,
    })).toBe(true);

    expect(canShowPartnerPromptQuote({
      now,
      answeredCount: 4,
    })).toBe(false);
  });

  it('can still apply an optional first-open day gate', () => {
    expect(canShowPartnerPromptQuote({
      now,
      firstOpenDate: '2026-04-25',
      answeredCount: 5,
      minDays: 5,
    })).toBe(true);

    expect(canShowPartnerPromptQuote({
      now,
      firstOpenDate: '2026-04-26',
      answeredCount: 5,
      minDays: 5,
    })).toBe(false);
  });
});

describe('chooseDailyPartnerPromptQuote', () => {
  const rows = [
    {
      prompt_id: 'p1',
      date_key: '2026-04-20',
      partnerAnswer: 'First remembered answer.',
    },
    {
      prompt_id: 'p2',
      date_key: '2026-04-21',
      partnerAnswer: 'Second remembered answer.',
    },
  ];

  it('keeps the selected partner answer fixed for the current daily window', async () => {
    const first = await chooseDailyPartnerPromptQuote(rows, {
      now: new Date(2026, 4, 5, 12),
      random: () => 0.9,
    });
    const second = await chooseDailyPartnerPromptQuote(rows, {
      now: new Date(2026, 4, 5, 18),
      random: () => 0,
    });

    expect(first.prompt_id).toBe('p2');
    expect(second.prompt_id).toBe('p2');
    expect(second.answer).toBe('Second remembered answer.');
  });

  it('uses the same daily quote before the 4am rollover', async () => {
    const first = await chooseDailyPartnerPromptQuote(rows, {
      now: new Date(2026, 4, 5, 23),
      random: () => 0,
    });
    const beforeRollover = await chooseDailyPartnerPromptQuote(rows, {
      now: new Date(2026, 4, 6, 3, 30),
      random: () => 0.9,
    });
    const afterRollover = await chooseDailyPartnerPromptQuote(rows, {
      now: new Date(2026, 4, 6, 4, 1),
      random: () => 0.9,
    });

    expect(first.prompt_id).toBe('p1');
    expect(beforeRollover.prompt_id).toBe('p1');
    expect(afterRollover.prompt_id).toBe('p2');
  });
});

describe('getPartnerPromptQuoteCandidateCount', () => {
  it('counts only past non-quiz rows with partner answers', () => {
    expect(getPartnerPromptQuoteCandidateCount([
      { prompt_id: 'p1', date_key: '2026-04-29', partnerAnswer: 'A real answer.' },
      { prompt_id: 'p2', date_key: '2026-04-30', partnerAnswer: 'Today is excluded.' },
      { prompt_id: 'quiz:p3', date_key: '2026-04-28', partnerAnswer: 'Quiz is excluded.' },
      { prompt_id: 'p4', date_key: '2026-04-27', partnerAnswer: '   ' },
    ], { now: new Date(2026, 3, 30, 12) })).toBe(1);
  });
});
