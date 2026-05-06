import AsyncStorage from '@react-native-async-storage/async-storage';
import { promptStorage, STORAGE_KEYS } from '../../utils/storage';

describe('promptStorage', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    jest.spyOn(Date, 'now').mockReturnValue(1778000000000);
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

  it('stores prompt answers with an owner and only returns them for that user', async () => {
    await promptStorage.setAnswer('2026-05-05', 'today-1', {
      answer: 'Partner one answer',
      userId: 'user-1',
    });

    await expect(
      promptStorage.getAnswerForUser('2026-05-05', 'today-1', 'user-1')
    ).resolves.toEqual(expect.objectContaining({
      answer: 'Partner one answer',
      userId: 'user-1',
      user_id: 'user-1',
    }));

    await expect(
      promptStorage.getAnswerForUser('2026-05-05', 'today-1', 'user-2')
    ).resolves.toBeNull();
  });

  it('ignores unowned legacy prompt answers when a signed-in user is scoped', async () => {
    store.set(STORAGE_KEYS.PROMPT_ANSWERS, JSON.stringify({
      '2026-05-05': {
        'today-1': {
          answer: 'Legacy unscoped answer',
          timestamp: 1777999999999,
        },
      },
    }));

    await expect(
      promptStorage.getAnswerForUser('2026-05-05', 'today-1', 'user-2')
    ).resolves.toBeNull();

    await expect(
      promptStorage.getAnswer('2026-05-05', 'today-1')
    ).resolves.toEqual(expect.objectContaining({
      answer: 'Legacy unscoped answer',
    }));
  });
});
