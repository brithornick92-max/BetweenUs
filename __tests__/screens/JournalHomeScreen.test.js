const React = require('react');
const {
  findTouchablesByText,
  flushEffects,
  renderScreen,
  createNavigation,
  resetScreenHarnessMocks,
  mockGetJournalEntries,
  mockStorageGet,
  mockStorageSet,
} = require('../helpers/screenTestHarness');

const JournalHomeScreen = require('../../screens/JournalHomeScreen').default;

describe('JournalHomeScreen', () => {
  beforeEach(() => {
    resetScreenHarnessMocks();
  });

  it('navigates to a new shared entry from the empty state', async () => {
    mockGetJournalEntries.mockResolvedValueOnce([]);
    mockStorageGet.mockResolvedValueOnce(true);

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

  it('dismisses the shared journal notice and persists that preference', async () => {
    mockGetJournalEntries.mockResolvedValueOnce([]);
    mockStorageGet.mockResolvedValueOnce(false);

    const navigation = createNavigation();

    const tree = await renderScreen(JournalHomeScreen, { navigation });
    await flushEffects();

    const [dismissButton] = tree.root.findAllByProps({ accessibilityLabel: 'Dismiss journal notice' });
    expect(dismissButton).toBeTruthy();

    await require('../helpers/screenTestHarness').renderer.act(async () => {
      await dismissButton.props.onPress();
    });

    expect(mockStorageSet).toHaveBeenCalledWith('@betweenus:sharedJournalNoticeDismissed', true);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Dismiss journal notice' })).toHaveLength(0);
  });
});