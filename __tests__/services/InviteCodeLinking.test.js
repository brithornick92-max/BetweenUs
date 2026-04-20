jest.mock('tweetnacl-util', () => ({
  decodeBase64: jest.fn((value) => value),
}));

describe('InviteCodeLinking', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function createDeps({
    coupleId = 'couple-1',
    partnerKey = 'partner-public-key',
    partnerUserId = 'partner-user-1',
  } = {}) {
    return {
      coupleService: {
        getMyCouple: jest.fn().mockResolvedValue(coupleId ? { couple_id: coupleId } : null),
        setMyWrappedCoupleKey: jest.fn().mockResolvedValue(true),
        setWrappedCoupleKeyForMember: jest.fn().mockResolvedValue(true),
      },
      cloudEngine: {
        joinCouple: jest.fn().mockResolvedValue(true),
        waitForPartnerMembership: jest.fn().mockResolvedValue(
          partnerKey ? { user_id: partnerUserId, public_key: partnerKey } : null
        ),
      },
      coupleKeyService: {
        getCoupleKey: jest.fn().mockResolvedValue(null),
        getDevicePublicKeyB64: jest.fn().mockResolvedValue('public-key-1'),
        wrapKeyForDevice: jest.fn().mockResolvedValue('wrapped-key'),
        deriveFromKeyExchange: jest.fn().mockResolvedValue('derived-couple-key'),
        storeCoupleKey: jest.fn().mockResolvedValue(undefined),
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
      myPublicKeyB64: 'public-key-1',
      dependencies: deps,
    });

    expect(result).toBeNull();
    expect(deps.cloudEngine.joinCouple).not.toHaveBeenCalled();
    expect(deps.storageRouter.setActiveCoupleId).not.toHaveBeenCalled();
  });

  it('fails invite-code finalization when the partner key never becomes available', async () => {
    const { finalizeInviteCodeLink } = require('../../services/linking/InviteCodeLinking');
    const deps = createDeps({ partnerKey: null });

    await expect(finalizeInviteCodeLink({
      coupleId: 'couple-1',
      userId: 'user-1',
      updateProfile: jest.fn(),
      myPublicKeyB64: 'public-key-1',
      dependencies: deps,
    })).rejects.toThrow(
      'Link created, but secure setup is still finishing. Ask your partner to reopen the invite screen, then try again.'
    );

    expect(deps.cloudEngine.joinCouple).toHaveBeenCalledWith('couple-1', 'public-key-1');
    expect(deps.coupleKeyService.storeCoupleKey).not.toHaveBeenCalled();
  });
});