jest.mock('../../context/EntitlementsContext', () => ({
  clearCouplePremiumCache: jest.fn().mockResolvedValue(undefined),
}));

const { clearCouplePremiumCache } = require('../../context/EntitlementsContext');

describe('CouplePresenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createDeps({
    remoteCoupleId = 'couple-1',
    hasCoupleKey = true,
    secondRemoteCoupleId,
  } = {}) {
    const getMyCouple = jest.fn()
      .mockResolvedValueOnce(remoteCoupleId ? { couple_id: remoteCoupleId } : null);

    if (secondRemoteCoupleId !== undefined) {
      getMyCouple.mockResolvedValueOnce(secondRemoteCoupleId ? { couple_id: secondRemoteCoupleId } : null);
    }

    return {
      coupleService: {
        getMyCouple,
        unlinkFromCouple: jest.fn().mockResolvedValue(true),
      },
      coupleKeyService: {
        hasCoupleKey: jest.fn().mockResolvedValue(hasCoupleKey),
        clearCoupleKey: jest.fn().mockResolvedValue(undefined),
      },
      storageRouter: {
        updateUserDocument: jest.fn().mockResolvedValue(undefined),
      },
      storageApi: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('keeps the remote couple id as the authoritative pair state', async () => {
    const { getVerifiedCoupleState } = require('../../services/couple/CouplePresenceService');
    const deps = createDeps({ remoteCoupleId: 'remote-couple-1', hasCoupleKey: true });

    const result = await getVerifiedCoupleState({
      currentCoupleId: 'local-couple-1',
      userId: 'user-1',
      requireRemoteCheck: true,
      dependencies: deps,
    });

    expect(result).toEqual(expect.objectContaining({
      coupleId: 'remote-couple-1',
      hasCoupleKey: true,
      status: 'paired_key_ready',
    }));
    expect(deps.storageApi.set).toHaveBeenCalledWith('@betweenus:coupleId', 'remote-couple-1');
  });

  it('only clears local pair state after a confirmed remote miss', async () => {
    const { getVerifiedCoupleState } = require('../../services/couple/CouplePresenceService');
    const deps = createDeps({ remoteCoupleId: null, secondRemoteCoupleId: null, hasCoupleKey: false });

    const result = await getVerifiedCoupleState({
      currentCoupleId: 'stale-couple-1',
      userId: 'user-1',
      requireRemoteCheck: true,
      dependencies: deps,
    });

    expect(result).toEqual(expect.objectContaining({
      coupleId: null,
      status: 'unpaired',
    }));
    expect(deps.storageApi.remove).toHaveBeenCalledWith('@betweenus:coupleId');
    expect(deps.coupleKeyService.clearCoupleKey).toHaveBeenCalledWith('stale-couple-1');
    expect(deps.storageRouter.updateUserDocument).toHaveBeenCalledWith('user-1', { coupleId: null });
    expect(clearCouplePremiumCache).toHaveBeenCalled();
  });

  it('uses the same cleanup path for unlinking', async () => {
    const { unlinkCouple } = require('../../services/couple/CouplePresenceService');
    const deps = createDeps({ remoteCoupleId: null, hasCoupleKey: false });
    const onProfileCleared = jest.fn();

    await unlinkCouple({
      coupleId: 'couple-1',
      userId: 'user-1',
      onProfileCleared,
      dependencies: deps,
    });

    expect(deps.coupleService.unlinkFromCouple).toHaveBeenCalledTimes(1);
    expect(deps.storageApi.remove).toHaveBeenCalledWith('@betweenus:partnerProfile');
    expect(onProfileCleared).toHaveBeenCalledWith({ coupleId: null });
  });
});