jest.mock('../../services/security/PairingPayload', () => ({
  makePairingPayload: jest.fn(({ pairingCode, publicKey }) => ({
    v: 3,
    t: 'betweenus_pair',
    pairingCode,
    publicKey,
    createdAt: 123,
  })),
  parsePairingPayload: jest.fn((raw) => ({
    ok: true,
    payload: typeof raw === 'string' ? JSON.parse(raw) : raw,
  })),
}));

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

  it('prepares a new QR pairing flow through the shared orchestrator', async () => {
    const { preparePairingQrCode } = require('../../services/linking/CoupleLinkingService');
    const deps = createDeps();
    const updateProfile = jest.fn();

    const result = await preparePairingQrCode({
      userId: 'user-1',
      updateProfile,
      dependencies: deps,
    });

    expect(result).toEqual({
      coupleId: 'new-couple-id',
      isRepairFlow: false,
      qrPayload: JSON.stringify({
        v: 3,
        t: 'betweenus_pair',
        pairingCode: 'ABC123',
        publicKey: 'device-public-key',
        createdAt: 123,
      }),
    });
    expect(deps.cloudEngine.createCouple).toHaveBeenCalledWith('device-public-key');
    expect(deps.storageRouter.updateUserDocument).toHaveBeenCalledWith('user-1', { coupleId: 'new-couple-id' });
    expect(updateProfile).toHaveBeenCalledWith({ coupleId: 'new-couple-id' });
  });

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

  it('scans a QR pairing payload through the shared orchestrator', async () => {
    const { scanPairingCode } = require('../../services/linking/CoupleLinkingService');
    const deps = createDeps();

    const result = await scanPairingCode({
      rawPayload: JSON.stringify({ pairingCode: 'QR1234', publicKey: 'inviter-public-key' }),
      userId: 'user-1',
      updateProfile: jest.fn(),
      dependencies: deps,
    });

    expect(result).toEqual({ coupleId: 'scan-couple-id', isRepairFlow: false });
    expect(deps.coupleService.redeemPairingCode).toHaveBeenCalledWith('QR1234', 'device-public-key');
    expect(deriveAndPersistWrappedCoupleKey).toHaveBeenCalledWith(expect.objectContaining({
      coupleId: 'scan-couple-id',
      partnerUserId: 'partner-user-2',
      partnerPublicKeyB64: 'inviter-public-key',
    }));
    expect(backfillWrappedKeysFromLocalKey).not.toHaveBeenCalled();
    expect(restoreWrappedCoupleKeyFromCloud).not.toHaveBeenCalled();
  });
});