describe('MomentSignalSender', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadConnectionEngine(supabaseConfig) {
    jest.doMock('../../config/supabase', () => supabaseConfig);
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    AsyncStorage.getItem.mockReset();
    AsyncStorage.setItem.mockReset();
    AsyncStorage.removeItem.mockReset();
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);

    const service = require('../../services/ConnectionEngine');
    return { ...service, AsyncStorage };
  }

  function mockContext(AsyncStorage, { userId, coupleId, lastSent = null } = {}) {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === '@betweenus:cache:momentLastSent') return lastSent;
      if (key === '@betweenus:cache:momentUserId') return userId;
      if (key === '@betweenus:cache:momentCoupleId') return coupleId;
      return null;
    });
  }

  it('clears stale sender context when auth or pairing is missing', async () => {
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({ supabase: null, TABLES: {} });

    MomentSignalSender.configure({ userId: null, coupleId: undefined });
    await Promise.resolve();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@betweenus:cache:momentUserId');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@betweenus:cache:momentCoupleId');
  });

  it('rejects heartbeat when remote delivery is unavailable', async () => {
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({ supabase: null, TABLES: {} });
    mockContext(AsyncStorage, {
      userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coupleId: 'couple-1',
    });

    const result = await MomentSignalSender.sendHeartbeat({
      id: 'tender',
      name: 'Tender',
      icon: 'heart-outline',
      color: '#FF6B98',
      emoji: '💗',
    });

    expect(result.sent).toBe(false);
    expect(result.remote).toBe(false);
    expect(result.error).toBe('Sync is not configured on this device.');
  });

  it('writes the heartbeat signal remotely when the couple context is valid', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            error: null,
          }),
        },
        from,
      },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });
    mockContext(AsyncStorage, {
      userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coupleId: 'couple-1',
    });

    const result = await MomentSignalSender.sendHeartbeat({
      id: 'tender',
      name: 'Tender',
      icon: 'heart-outline',
      color: '#FF6B98',
      emoji: '💗',
    });

    expect(result).toMatchObject({ sent: true, remote: true, type: 'heartbeat' });
    expect(from).toHaveBeenCalledWith('couple_data');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      couple_id: 'couple-1',
      data_type: 'moment_signal',
      created_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      value: expect.objectContaining({
        moment_type: 'heartbeat',
        sender_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        vibe_id: 'tender',
        vibe_type: 'tender',
        vibe_label: 'tender',
        vibe_color: '#FF6B98',
        vibe_icon: 'heart-outline',
      }),
    }));
  });

  it('enforces the 5-minute cooldown between signals', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            error: null,
          }),
        },
        from,
      },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });
    mockContext(AsyncStorage, {
      userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coupleId: 'couple-1',
    });

    const first = await MomentSignalSender.sendHeartbeat();
    expect(first.sent).toBe(true);

    const second = await MomentSignalSender.sendHeartbeat();
    expect(second.sent).toBe(false);
    expect(second.cooldown).toBe(true);
    expect(second.error).toMatch(/wait/i);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('sends non-heartbeat signal types correctly', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
            error: null,
          }),
        },
        from,
      },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });
    mockContext(AsyncStorage, {
      userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      coupleId: 'couple-1',
    });

    const result = await MomentSignalSender.send('thinking');

    expect(result).toMatchObject({ sent: true, remote: true, type: 'thinking' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({ moment_type: 'thinking' }),
    }));
  });
});
