import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addRestoredDeckItem,
  getContentDeckRestoreState,
  getRestoredDeckItemIds,
  removeRestoredDeckItem,
} from '../../utils/contentDeckRestores';

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
});

describe('contentDeckRestores', () => {
  it('starts with empty restore buckets', async () => {
    const state = await getContentDeckRestoreState();

    expect(state).toEqual({
      prompts: [],
      dates: [],
      positions: [],
    });
  });

  it('adds restored items per content type', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      prompts: [],
      dates: [],
      positions: [],
    }));

    await addRestoredDeckItem('prompts', 'prompt-1');

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('reads restored ids back as a set', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      prompts: ['prompt-1', 'prompt-2'],
      dates: [],
      positions: [],
    }));

    const ids = await getRestoredDeckItemIds('prompts');

    expect(ids.has('prompt-1')).toBe(true);
    expect(ids.has('prompt-2')).toBe(true);
  });

  it('removes restored items by id', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      prompts: ['prompt-1', 'prompt-2'],
      dates: [],
      positions: [],
    }));

    await removeRestoredDeckItem('prompts', 'prompt-1');

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
