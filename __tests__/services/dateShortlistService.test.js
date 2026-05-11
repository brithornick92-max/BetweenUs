const mockFrom = jest.fn();

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

function createBuilder({ maybeSingleResult, singleResult } = {}) {
  const builder = {
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    order: jest.fn(() => builder),
    select: jest.fn(() => builder),
    maybeSingle: jest.fn(async () => maybeSingleResult || { data: null, error: null }),
    single: jest.fn(async () => singleResult || { data: null, error: null }),
  };

  return builder;
}

describe('dateShortlistService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the couple shortlist row when a partner insert loses a duplicate race', async () => {
    const { addDateToShortlist } = require('../../services/supabase/dateShortlistService');
    const initialRestore = createBuilder();
    const legacyPromote = createBuilder();
    const racingInsert = createBuilder({
      singleResult: {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "date_shortlist_couple_date_unique"',
        },
      },
    });
    const duplicateRestore = createBuilder({
      maybeSingleResult: {
        data: { date_id: 'date-1', created_at: '2026-05-10T12:00:00.000Z' },
        error: null,
      },
    });

    mockFrom
      .mockReturnValueOnce(initialRestore)
      .mockReturnValueOnce(legacyPromote)
      .mockReturnValueOnce(racingInsert)
      .mockReturnValueOnce(duplicateRestore);

    await expect(addDateToShortlist('user-2', 'date-1', 'couple-1')).resolves.toEqual({
      date_id: 'date-1',
      created_at: '2026-05-10T12:00:00.000Z',
    });

    expect(racingInsert.insert).toHaveBeenCalledWith({
      user_id: 'user-2',
      couple_id: 'couple-1',
      date_id: 'date-1',
      removed_at: null,
    });
    expect(racingInsert.upsert).not.toHaveBeenCalled();
    expect(duplicateRestore.update).toHaveBeenCalledWith({ removed_at: null });
  });

  it('keeps solo shortlist adds on the user/date upsert path', async () => {
    const { addDateToShortlist } = require('../../services/supabase/dateShortlistService');
    const soloUpsert = createBuilder({
      singleResult: {
        data: { date_id: 'date-1', created_at: '2026-05-10T12:00:00.000Z' },
        error: null,
      },
    });

    mockFrom.mockReturnValueOnce(soloUpsert);

    await expect(addDateToShortlist('user-1', 'date-1')).resolves.toEqual({
      date_id: 'date-1',
      created_at: '2026-05-10T12:00:00.000Z',
    });

    expect(soloUpsert.upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      couple_id: null,
      date_id: 'date-1',
      removed_at: null,
    }, { onConflict: 'user_id,date_id' });
    expect(soloUpsert.insert).not.toHaveBeenCalled();
  });
});
