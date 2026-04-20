describe('CloudEngine.joinCouple', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadCloudEngine({ maybeSingleResult, updateResult, insertResult }) {
    const updateEq = jest.fn().mockResolvedValue(updateResult ?? { error: null });
    const update = jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: updateEq,
      })),
    }));
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
      update,
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
      update,
      updateEq,
      insert,
    };
  }

  it('updates the existing membership key when the user is already in the target couple', async () => {
    const { CloudEngine, update, updateEq, insert } = loadCloudEngine({
      maybeSingleResult: {
        data: { couple_id: 'couple-1', public_key: null },
        error: null,
      },
    });

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await expect(CloudEngine.joinCouple('couple-1', 'public-key-1')).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith({ public_key: 'public-key-1' });
    expect(updateEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(insert).not.toHaveBeenCalled();
  });

  it('throws when the user already belongs to a different couple', async () => {
    const { CloudEngine, insert } = loadCloudEngine({
      maybeSingleResult: {
        data: { couple_id: 'couple-2', public_key: 'public-key-2' },
        error: null,
      },
    });

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await expect(CloudEngine.joinCouple('couple-1', 'public-key-1')).rejects.toThrow(
      'You are already linked to a partner. Leave your current couple first.'
    );

    expect(insert).not.toHaveBeenCalled();
  });

  it('reads wrapped key material for the current membership', async () => {
    const { CloudEngine } = loadCloudEngine({
      maybeSingleResult: {
        data: { public_key: 'public-key-1', wrapped_couple_key: 'wrapped-key-1' },
        error: null,
      },
    });

    await CloudEngine.initialize({ supabaseSessionPresent: true });
    await expect(CloudEngine.getMyMembershipKeyMaterial('couple-1')).resolves.toEqual({
      public_key: 'public-key-1',
      wrapped_couple_key: 'wrapped-key-1',
    });
  });
});