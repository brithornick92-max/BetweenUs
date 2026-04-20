const React = require('react');
const {
  Image,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockUpdateJournalEntry,
  mockGetJournalEntries,
  mockNeedsReconnect,
  mockStorageGet,
  mockStorageSet,
} = require('../helpers/screenTestHarness');

const JournalEntryScreen = require('../../screens/JournalEntryScreen').default;
const JournalHomeScreen = require('../../screens/JournalHomeScreen').default;

describe('Journal sharing screens', () => {
  beforeEach(() => {
    resetScreenHarnessMocks();
  });

  it('keeps an existing journal photo when editing and saving an entry', async () => {
    const navigation = createNavigation();
    const route = {
      params: {
        entry: {
          id: 'journal-1',
          user_id: 'user-1',
          title: 'Sunday together',
          body: 'Kept the photo attached.',
          mood: 'connected',
          photo_uri: 'file:///persisted-photo.jpg',
          created_at: '2026-04-19T12:00:00.000Z',
        },
      },
    };

    const tree = await renderScreen(JournalEntryScreen, { navigation, route });

    const imageNodes = tree.root.findAllByType(Image);
    expect(imageNodes.some((node) => node.props.source?.uri === 'file:///persisted-photo.jpg')).toBe(true);

    const [saveButton] = findTouchablesByText(tree.root, 'Save');
    expect(saveButton).toBeTruthy();

    await require('../helpers/screenTestHarness').renderer.act(async () => {
      await saveButton.props.onPress();
    });

    expect(mockUpdateJournalEntry).toHaveBeenCalledWith(
      'journal-1',
      expect.objectContaining({
        imageUri: 'file:///persisted-photo.jpg',
        isPrivate: false,
      })
    );
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('shows shared journal photo thumbnails and opens partner entries read-only', async () => {
    mockGetJournalEntries.mockResolvedValueOnce([
      {
        id: 'shared-1',
        user_id: 'partner-1',
        title: 'Partner reflection',
        body: 'A shared memory with a photo.',
        photo_uri: 'https://cdn.example.com/shared-photo.jpg',
        created_at: '2026-04-19T12:00:00.000Z',
      },
    ]);
    mockStorageGet.mockResolvedValueOnce(true);

    const navigation = createNavigation();

    const tree = await renderScreen(JournalHomeScreen, { navigation });
    await flushEffects();

    const imageNodes = tree.root.findAllByType(Image);
    expect(imageNodes.some((node) => node.props.source?.uri === 'https://cdn.example.com/shared-photo.jpg')).toBe(true);

    const [partnerCard] = tree.root.findAllByProps({ accessibilityLabel: 'Partner reflection' });
    expect(partnerCard).toBeTruthy();

    await require('../helpers/screenTestHarness').renderer.act(async () => {
      partnerCard.props.onPress();
    });

    expect(mockGetJournalEntries).toHaveBeenCalledWith({ limit: 500, visibility: 'shared' });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'JournalEntry',
      expect.objectContaining({
        entry: expect.objectContaining({ id: 'shared-1' }),
        readOnly: true,
      })
    );
  });
});