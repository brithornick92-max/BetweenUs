const {
  findTouchablesByText,
  flushEffects,
  renderScreen,
  createNavigation,
  resetScreenHarnessMocks,
  mockGetJournalEntries,
  setAppContextMock,
} = require('../helpers/screenTestHarness');

const JournalHomeScreen = require('../../screens/JournalHomeScreen').default;

describe('JournalHomeScreen', () => {
  beforeEach(() => {
    resetScreenHarnessMocks();
  });

  it('navigates to a new shared entry from the empty state', async () => {
    setAppContextMock({ coupleId: 'couple-1', isLinked: true });
    mockGetJournalEntries.mockResolvedValueOnce([]);

    const navigation = createNavigation();

    const tree = await renderScreen(JournalHomeScreen, { navigation });
    await flushEffects();

    const [writeButton] = findTouchablesByText(tree.root, 'Write Shared Entry');
    expect(writeButton).toBeTruthy();

    await require('../helpers/screenTestHarness').renderer.act(async () => {
      writeButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('JournalEntry');
  });

  it('navigates to a new shared entry from the floating action button', async () => {
    setAppContextMock({ coupleId: 'couple-1', isLinked: true });
    mockGetJournalEntries.mockResolvedValueOnce([]);

    const navigation = createNavigation();

    const tree = await renderScreen(JournalHomeScreen, { navigation });
    await flushEffects();

    const [newEntryButton] = tree.root.findAllByProps({ accessibilityLabel: 'New shared entry' });
    expect(newEntryButton).toBeTruthy();

    await require('../helpers/screenTestHarness').renderer.act(async () => {
      newEntryButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('JournalEntry');
  });
});
