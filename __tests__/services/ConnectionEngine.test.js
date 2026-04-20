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

  it('clears stale sender context when auth or pairing is missing', async () => {
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({ supabase: null, TABLES: {} });

    MomentSignalSender.configure({ userId: null, coupleId: undefined });
    await Promise.resolve();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@bu_moment_user_id');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@bu_moment_couple_id');
  });

  it('rejects heartbeat when remote delivery is unavailable', async () => {
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({ supabase: null, TABLES: {} });

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === '@bu_moment_cooldown') return null;
      if (key === '@bu_moment_user_id') return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      if (key === '@bu_moment_couple_id') return 'couple-1';
      return null;
    });

    const result = await MomentSignalSender.sendHeartbeat();

    expect(result.sent).toBe(false);
    expect(result.remote).toBe(false);
    expect(result.error).toBe('Sync is not configured on this device.');
  });

  it('writes the heartbeat signal remotely when the couple context is valid', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: { from },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === '@bu_moment_cooldown') return null;
      if (key === '@bu_moment_user_id') return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      if (key === '@bu_moment_couple_id') return 'couple-1';
      return null;
    });

    const result = await MomentSignalSender.sendHeartbeat();

    expect(result).toMatchObject({ sent: true, remote: true, type: 'heartbeat' });
    expect(from).toHaveBeenCalledWith('couple_data');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      couple_id: 'couple-1',
      data_type: 'moment_signal',
      created_by: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      value: expect.objectContaining({
        moment_type: 'heartbeat',
        sender_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      }),
    }));
  });

  it('enforces the 5-minute cooldown between signals', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: { from },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === '@bu_moment_cooldown') return null;
      if (key === '@bu_moment_user_id') return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      if (key === '@bu_moment_couple_id') return 'couple-1';
      return null;
    });

    // First send should succeed
    const first = await MomentSignalSender.sendHeartbeat();
    expect(first.sent).toBe(true);

    // Immediate second send should be blocked by cooldown
    const second = await MomentSignalSender.sendHeartbeat();
    expect(second.sent).toBe(false);
    expect(second.cooldown).toBe(true);
    expect(second.error).toMatch(/wait/i);

    // Only one insert should have reached the DB
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('sends non-heartbeat signal types correctly', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn(() => ({ insert }));
    const { MomentSignalSender, AsyncStorage } = loadConnectionEngine({
      supabase: { from },
      TABLES: { COUPLE_DATA: 'couple_data' },
    });

    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (key === '@bu_moment_cooldown') return null;
      if (key === '@bu_moment_user_id') return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      if (key === '@bu_moment_couple_id') return 'couple-1';
      return null;
    });

    const result = await MomentSignalSender.send('thinking_of_you');

    expect(result).toMatchObject({ sent: true, remote: true, type: 'thinking_of_you' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      value: expect.objectContaining({ moment_type: 'thinking_of_you' }),
    }));
  });
});