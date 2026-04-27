describe('InviteCodeLinking', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function createDeps({
    coupleId = 'couple-1',
  } = {}) {
    return {
      coupleService: {
        getMyCouple: jest.fn().mockResolvedValue(coupleId ? { couple_id: coupleId } : null),
      },
      cloudEngine: {
        joinCouple: jest.fn().mockResolvedValue(true),
      },
      storageRouter: {
        setActiveCoupleId: jest.fn().mockResolvedValue(undefined),
        updateUserDocument: jest.fn().mockResolvedValue(undefined),
      },
      storageApi: {
        set: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('does not treat duplicate recovery as success when no couple membership exists', async () => {
    const { recoverExistingInviteCodeLink } = require('../../services/linking/InviteCodeLinking');
    const deps = createDeps({ coupleId: null });

    const result = await recoverExistingInviteCodeLink({
      userId: 'user-1',
      updateProfile: jest.fn(),
      dependencies: deps,
    });

    expect(result).toBeNull();
    expect(deps.cloudEngine.joinCouple).not.toHaveBeenCalled();
    expect(deps.storageRouter.setActiveCoupleId).not.toHaveBeenCalled();
  });

  it('finalizes invite-code linking through Supabase membership and cache', async () => {
    const { finalizeInviteCodeLink } = require('../../services/linking/InviteCodeLinking');
    const deps = createDeps();
    const updateProfile = jest.fn();

    await expect(finalizeInviteCodeLink({
      coupleId: 'couple-1',
      userId: 'user-1',
      updateProfile,
      dependencies: deps,
    })).resolves.toBe('couple-1');

    expect(deps.cloudEngine.joinCouple).toHaveBeenCalledWith('couple-1');
    expect(deps.storageRouter.setActiveCoupleId).toHaveBeenCalledWith('couple-1');
    expect(updateProfile).toHaveBeenCalledWith({ coupleId: 'couple-1' });
  });
});
