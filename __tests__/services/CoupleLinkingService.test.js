jest.mock('../../services/linking/InviteCodeLinking', () => ({
  finalizeInviteCodeLink: jest.fn().mockResolvedValue('couple-joined'),
}));

jest.mock('../../services/security/WrappedCoupleKeyFlow', () => ({
  backfillWrappedKeysFromLocalKey: jest.fn().mockResolvedValue(undefined),
  deriveAndPersistWrappedCoupleKey: jest.fn().mockResolvedValue(undefined),
  restoreWrappedCoupleKeyFromCloud: jest.fn().mockResolvedValue('restored-key'),
}));

const { finalizeInviteCodeLink } = require('../../services/linking/InviteCodeLinking');
const {
  backfillWrappedKeysFromLocalKey,
  deriveAndPersistWrappedCoupleKey,
  restoreWrappedCoupleKeyFromCloud,
} = require('../../services/security/WrappedCoupleKeyFlow');

describe('CoupleLinkingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createDeps({
    storedCoupleId = null,
    membershipCoupleId = null,
  } = {}) {
    return {
      supabaseAuthService: {
        getSession: jest.fn().mockResolvedValue({ access_token: 'token' }),
        signInAnonymously: jest.fn().mockResolvedValue({ access_token: 'anon-token' }),
      },
      storageRouter: {
        setSupabaseSession: jest.fn().mockResolvedValue(undefined),
        setActiveCoupleId: jest.fn().mockResolvedValue(undefined),
        updateUserDocument: jest.fn().mockResolvedValue(undefined),
      },
      cloudEngine: {
        initialize: jest.fn().mockResolvedValue(true),
        createCouple: jest.fn().mockResolvedValue('new-couple-id'),
        joinCouple: jest.fn().mockResolvedValue(true),
        waitForPartnerMembership: jest.fn().mockResolvedValue({
          user_id: 'partner-user-1',
          public_key: 'partner-public-key',
        }),
      },
      coupleKeyService: {
        getDevicePublicKeyB64: jest.fn().mockResolvedValue('device-public-key'),
      },
      coupleService: {
        getMyCouple: jest.fn().mockResolvedValue(membershipCoupleId ? { couple_id: membershipCoupleId } : null),
        generatePairingCode: jest.fn().mockResolvedValue({ code: 'ABC123' }),
        redeemInviteCode: jest.fn().mockResolvedValue({ coupleId: 'invite-couple-id' }),
        redeemPairingCode: jest.fn().mockResolvedValue({ coupleId: 'scan-couple-id', partnerId: 'partner-user-2' }),
      },
      storageApi: {
        get: jest.fn().mockResolvedValue(storedCoupleId),
        set: jest.fn().mockResolvedValue(undefined),
      },
    };
  }

  it('joins from invite code through the shared orchestrator', async () => {
    const { joinWithInviteCode } = require('../../services/linking/CoupleLinkingService');
    const deps = createDeps();

    const result = await joinWithInviteCode({
      code: ' ABC123 ',
      userId: 'user-1',
      updateProfile: jest.fn(),
      dependencies: deps,
    });

    expect(result).toEqual({ coupleId: 'invite-couple-id' });
    expect(deps.coupleService.redeemInviteCode).toHaveBeenCalledWith('ABC123');
    expect(finalizeInviteCodeLink).toHaveBeenCalledWith(expect.objectContaining({
      coupleId: 'invite-couple-id',
      userId: 'user-1',
    }));
  });
});
