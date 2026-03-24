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
      if (key === '@bu_moment_user_id') return 'user-1';
      if (key === '@bu_moment_couple_id') return 'couple-1';
      return null;
    });

    const result = await MomentSignalSender.sendHeartbeat();

    expect(result.sent).toBe(false);
    expect(result.remote).toBe(false);
    expect(result.error).toBe('Sync is not configured on this device.');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@bu_moment_cooldown', expect.any(String));
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@bu_moment_cooldown');
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
      if (key === '@bu_moment_user_id') return 'user-1';
      if (key === '@bu_moment_couple_id') return 'couple-1';
      return null;
    });

    const result = await MomentSignalSender.sendHeartbeat();

    expect(result).toMatchObject({ sent: true, remote: true, type: 'heartbeat' });
    expect(from).toHaveBeenCalledWith('couple_data');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      couple_id: 'couple-1',
      data_type: 'moment_signal',
      created_by: 'user-1',
      value: expect.any(String),
    }));

    const payload = JSON.parse(insert.mock.calls[0][0].value);
    expect(payload).toMatchObject({
      moment_type: 'heartbeat',
      sender_id: 'user-1',
    });
  });
});