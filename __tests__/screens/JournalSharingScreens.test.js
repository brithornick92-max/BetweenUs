const {
  Image,
  renderer,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockUpdateJournalEntry,
  mockGetJournalEntries,
  mockStorageGet,
  mockShowPaywall,
  setEntitlementsMock,
} = require('../helpers/screenTestHarness');

const JournalEntryScreen = require('../../screens/JournalEntryScreen').default;
const JournalHomeModule = require('../../screens/JournalHomeScreen');
const JournalHomeScreen = JournalHomeModule.default;
const { buildDateGroupedJournalList } = JournalHomeModule;
const { VideoView } = require('expo-video');

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
    const persistedPhoto = imageNodes.find((node) => node.props.source?.uri === 'file:///persisted-photo.jpg');
    expect(persistedPhoto).toBeTruthy();
    expect(persistedPhoto.props.resizeMode).toBe('contain');

    const [saveButton] = findTouchablesByText(tree.root, 'Save');
    expect(saveButton).toBeTruthy();

    await renderer.act(async () => {
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

  it('does not auto-paywall free users when opening the journal entry screen', async () => {
    setEntitlementsMock({ isPremiumEffective: false });

    const navigation = createNavigation({
      canGoBack: jest.fn(() => true),
    });

    await renderScreen(JournalEntryScreen, { navigation, route: { params: {} } });
    await flushEffects();

    expect(mockShowPaywall).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
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
    const sharedPhoto = imageNodes.find((node) => node.props.source?.uri === 'https://cdn.example.com/shared-photo.jpg');
    expect(sharedPhoto).toBeTruthy();
    expect(sharedPhoto.props.resizeMode).toBe('contain');

    const [partnerCard] = tree.root.findAllByProps({ accessibilityLabel: 'Partner reflection' });
    expect(partnerCard).toBeTruthy();

    await renderer.act(async () => {
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

  it('keeps an existing journal video attachment when saving an entry unchanged', async () => {
    const navigation = createNavigation();
    const route = {
      params: {
        entry: {
          id: 'journal-video-1',
          user_id: 'user-1',
          title: 'Our clip',
          body: 'Kept the video attached.',
          mood: 'connected',
          mediaRef: 'att-video-1',
          mediaUri: 'file:///persisted-video.mp4',
          mediaType: 'video/mp4',
          created_at: '2026-04-19T12:00:00.000Z',
        },
      },
    };

    const tree = await renderScreen(JournalEntryScreen, { navigation, route });
    const [videoPreview] = tree.root.findAllByType(VideoView);
    expect(videoPreview).toBeTruthy();
    expect(videoPreview.props.contentFit).toBe('contain');

    const [saveButton] = findTouchablesByText(tree.root, 'Save');
    await renderer.act(async () => {
      await saveButton.props.onPress();
    });

    expect(mockUpdateJournalEntry).toHaveBeenCalledWith(
      'journal-video-1',
      expect.not.objectContaining({
        mediaUri: expect.anything(),
      })
    );
  });

  it('shows shared journal video entries with a video indicator', async () => {
    mockGetJournalEntries.mockResolvedValueOnce([
      {
        id: 'shared-video-1',
        user_id: 'partner-1',
        title: 'Partner video',
        body: 'A shared memory with a clip.',
        mediaUri: 'file:///shared-video.mp4',
        mediaType: 'video/mp4',
        mediaKind: 'video',
        created_at: '2026-04-19T12:00:00.000Z',
      },
    ]);
    mockStorageGet.mockResolvedValueOnce(true);

    const navigation = createNavigation();
    const tree = await renderScreen(JournalHomeScreen, { navigation });
    await flushEffects();

    const [videoLabel] = tree.root.findAllByProps({ children: 'Video attached' });
    expect(videoLabel).toBeTruthy();

    const [videoPreview] = tree.root.findAllByType(VideoView);
    expect(videoPreview).toBeTruthy();
    expect(videoPreview.props.contentFit).toBe('contain');
  });

  it('shows both partners journal entries newest first with date grouping', async () => {
    mockGetJournalEntries.mockResolvedValueOnce([
      {
        id: 'older-mine',
        user_id: 'user-1',
        title: 'My older note',
        body: 'Written by me.',
        created_at: '2026-04-18T12:00:00.000Z',
      },
      {
        id: 'newer-partner',
        user_id: 'partner-1',
        title: 'Partner newer note',
        body: 'Written by partner.',
        created_at: '2026-04-19T12:00:00.000Z',
      },
    ]);
    mockStorageGet.mockResolvedValueOnce(true);

    const navigation = createNavigation();
    const tree = await renderScreen(JournalHomeScreen, { navigation });
    await flushEffects();

    expect(mockGetJournalEntries).toHaveBeenCalledWith({ limit: 500, visibility: 'shared' });

    const titles = tree.root
      .findAllByType(require('react-native').Text)
      .map((node) => node.props.children)
      .filter((text) => text === 'Partner newer note' || text === 'My older note');

    expect(titles).toEqual(['Partner newer note', 'My older note']);
    expect(tree.root.findAllByProps({ children: 'April 19, 2026' }).length).toBeGreaterThanOrEqual(1);
    expect(tree.root.findAllByProps({ children: 'April 18, 2026' }).length).toBeGreaterThanOrEqual(1);
  });

  it('builds journal date groups from newest entries first', () => {
    const rows = buildDateGroupedJournalList([
      {
        id: 'journal:newer',
        title: 'Newer',
        sortAt: '2026-04-19T12:00:00.000Z',
        dateGroupLabel: 'April 19, 2026',
      },
      {
        id: 'journal:older',
        title: 'Older',
        sortAt: '2026-04-18T12:00:00.000Z',
        dateGroupLabel: 'April 18, 2026',
      },
    ]);

    expect(rows.map((row) => row.kind || 'journal')).toEqual([
      'date_header',
      'journal',
      'date_header',
      'journal',
    ]);
    expect(rows[0].title).toBe('April 19, 2026');
    expect(rows[2].title).toBe('April 18, 2026');
  });
});
