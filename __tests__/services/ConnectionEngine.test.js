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

  it('resolves direct realtime subscriber ids before filtering own signals', async () => {
    const authUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const partnerUserId = 'b1b2c3d4-e5f6-7890-abcd-ef1234567890';
    let handleChange = null;
    const channel = {
      on: jest.fn((event, _filter, callback) => {
        if (event === 'postgres_changes') handleChange = callback;
        return channel;
      }),
      subscribe: jest.fn(() => channel),
    };
    const removeChannel = jest.fn();
    const onSignal = jest.fn();
    const { MomentSignalSender } = loadConnectionEngine({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: authUserId } },
            error: null,
          }),
        },
        channel: jest.fn(() => channel),
        removeChannel,
      },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });

    const unsubscribe = MomentSignalSender.subscribeToSignals(onSignal, {
      coupleId: 'couple-1',
      userId: 'local-device-user',
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(handleChange).toEqual(expect.any(Function));

    handleChange({
      new: {
        data_type: 'moment_signal',
        created_by: authUserId,
        value: { moment_type: 'heartbeat' },
      },
    });
    expect(onSignal).not.toHaveBeenCalled();

    handleChange({
      new: {
        data_type: 'moment_signal',
        created_by: partnerUserId,
        value: { moment_type: 'heartbeat' },
      },
    });
    expect(onSignal).toHaveBeenCalledWith({ moment_type: 'heartbeat' });

    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it('resolves cached local ids before fetching received signals', async () => {
    const authUserId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      neq: jest.fn(() => query),
      order: jest.fn(() => query),
      limit: jest.fn(() => Promise.resolve({
        data: [{ value: { moment_type: 'heartbeat' }, created_at: '2026-05-05T12:00:00.000Z' }],
        error: null,
      })),
    };
    const from = jest.fn(() => query);
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: authUserId } },
            error: null,
          }),
        },
        from,
      },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });
    mockContext(AsyncStorage, {
      userId: 'local-device-user',
      coupleId: 'couple-1',
    });

    const result = await MomentSignalSender.getReceivedSignals();

    expect(from).toHaveBeenCalledWith('couple_data');
    expect(query.neq).toHaveBeenCalledWith('created_by', authUserId);
    expect(result).toEqual([{ moment_type: 'heartbeat' }]);
  });
});
