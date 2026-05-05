import AsyncStorage from '@react-native-async-storage/async-storage';
import { vibeStorage } from '../../utils/storage';
import { VIBE_HISTORY_SOURCE_HEARTBEAT } from '../../utils/vibeSignalHistory';

describe('vibeStorage', () => {
  let store;
  const now = Date.parse('2026-05-05T12:00:00.000Z');

  beforeEach(() => {
    store = new Map();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    AsyncStorage.getItem.mockImplementation(async (key) => store.get(key) ?? null);
    AsyncStorage.setItem.mockImplementation(async (key, value) => {
      store.set(key, value);
    });
    AsyncStorage.removeItem.mockImplementation(async (key) => {
      store.delete(key);
    });
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  it('can filter recent own vibe history to heartbeat entries only', async () => {
    await vibeStorage.addVibeEntry({ id: 'tender' }, 'user-1', {
      source: VIBE_HISTORY_SOURCE_HEARTBEAT,
      timestamp: now,
    });
    await vibeStorage.addVibeEntry({ id: 'selection-only' }, 'user-1', {
      timestamp: now,
    });

    const recent = await vibeStorage.getRecentVibes(7, { source: VIBE_HISTORY_SOURCE_HEARTBEAT });

    expect(recent).toHaveLength(1);
    expect(recent[0].vibe.id).toBe('tender');
    expect(recent[0].source).toBe(VIBE_HISTORY_SOURCE_HEARTBEAT);
  });

  it('can filter recent partner vibe history to heartbeat entries only', async () => {
    await vibeStorage.addPartnerVibeEntry({ id: 'passionate' }, {
      source: VIBE_HISTORY_SOURCE_HEARTBEAT,
      timestamp: now,
    });
    await vibeStorage.addPartnerVibeEntry({ id: 'old-partner-vibe' }, {
      timestamp: now,
    });

    const recent = await vibeStorage.getRecentPartnerVibes(7, { source: VIBE_HISTORY_SOURCE_HEARTBEAT });

    expect(recent).toHaveLength(1);
    expect(recent[0].vibe.id).toBe('passionate');
    expect(recent[0].source).toBe(VIBE_HISTORY_SOURCE_HEARTBEAT);
  });
});
