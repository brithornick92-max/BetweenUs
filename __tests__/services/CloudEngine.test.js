describe('CloudEngine.joinCouple', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadCloudEngine({ maybeSingleResult, insertResult }) {
    const insert = jest.fn().mockResolvedValue(insertResult ?? { error: null });
    const maybeSingle = jest.fn().mockResolvedValue(maybeSingleResult ?? { data: null, error: null });
    const selectEq = jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle,
      })),
      maybeSingle,
    }));
    const select = jest.fn(() => ({
      eq: selectEq,
    }));
    const from = jest.fn(() => ({
      select,
      insert,
    }));

    jest.doMock('../../config/supabase', () => ({
      getSupabaseOrThrow: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
          }),
        },
        from,
      }),
      TABLES: {
        COUPLE_MEMBERS: 'couple_members',
      },
    }));

    const CloudEngine = require('../../services/storage/CloudEngine').default;
    return {
      CloudEngine,
      from,
      select,
      selectEq,
      maybeSingle,
      insert,
    };
  }

  it('returns true when the user is already in the target couple', async () => {
    const { CloudEngine, insert } = loadCloudEngine({
      maybeSingleResult: {
        data: { couple_id: 'couple-1' },
        error: null,
      },
    });

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await expect(CloudEngine.joinCouple('couple-1')).resolves.toBe(true);

    expect(insert).not.toHaveBeenCalled();
  });

  it('throws when the user already belongs to a different couple', async () => {
    const { CloudEngine, insert } = loadCloudEngine({
      maybeSingleResult: {
        data: { couple_id: 'couple-2' },
        error: null,
      },
    });

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await expect(CloudEngine.joinCouple('couple-1')).rejects.toThrow(
      'You are already linked to a partner. Leave your current couple first.'
    );

    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts a membership when the user is not already paired', async () => {
    const { CloudEngine, insert } = loadCloudEngine({
      maybeSingleResult: { data: null, error: null },
    });

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await expect(CloudEngine.joinCouple('couple-1')).resolves.toBe(true);

    expect(insert).toHaveBeenCalledWith({
      couple_id: 'couple-1',
      user_id: 'user-1',
      role: 'member',
    });
  });
});

describe('CloudEngine couple data boundaries', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadCloudEngineForCoupleData({ insertResult, updateResult } = {}) {
    const insert = jest.fn().mockResolvedValue(insertResult ?? { error: null });
    const finalEq = jest.fn().mockResolvedValue(updateResult ?? { error: null });
    const firstEq = jest.fn(() => ({ eq: finalEq }));
    const update = jest.fn(() => ({ eq: firstEq }));
    const from = jest.fn(() => ({
      insert,
      update,
    }));

    jest.doMock('../../config/supabase', () => ({
      getSupabaseOrThrow: () => ({
        from,
      }),
      TABLES: {
        COUPLE_DATA: 'couple_data',
      },
    }));

    const CloudEngine = require('../../services/storage/CloudEngine').default;
    return {
      CloudEngine,
      from,
      insert,
      update,
      firstEq,
      finalEq,
    };
  }

  it('persists the requested couple_data privacy flag on insert', async () => {
    const { CloudEngine, insert } = loadCloudEngineForCoupleData();

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await CloudEngine.saveCoupleData('couple-1', 'key-1', { body: 'private' }, 'user-1', true, 'journal');

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      couple_id: 'couple-1',
      key: 'key-1',
      created_by: 'user-1',
      data_type: 'journal',
      is_private: true,
    }));
  });

  it('does not clear is_private while updating a couple_data value', async () => {
    const { CloudEngine, update } = loadCloudEngineForCoupleData();

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await CloudEngine.updateCoupleData('couple-1', 'key-1', { body: 'updated' });

    expect(update).toHaveBeenCalledWith(expect.not.objectContaining({
      is_private: expect.anything(),
    }));
  });
});
