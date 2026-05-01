const {
  TextInput,
  renderer,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockDeletePromptAnswer,
  mockGetPromptAnswers,
  mockAlert,
  mockStorageGet,
  mockSavePromptAnswer,
  mockStorageRemove,
  mockStorageSet,
} = require('../helpers/screenTestHarness');

const CouplesQuizModule = require('../../screens/CouplesQuizScreen');
const CouplesQuizScreen = CouplesQuizModule.default;
const { getQuizCacheKeys } = CouplesQuizModule;

describe('CouplesQuizScreen', () => {
  beforeEach(() => {
    resetScreenHarnessMocks();
  });

  it('saves Daily Quiz answers through the prompt-answer path', async () => {
    const navigation = createNavigation();
    const tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const input = tree.root.findByType(TextInput);
    await renderer.act(async () => {
      input.props.onChangeText('They would choose coffee and a walk.');
    });

    const [submitButton] = findTouchablesByText(tree.root, 'Lock In My Answer');
    expect(submitButton).toBeTruthy();

    await renderer.act(async () => {
      await submitButton.props.onPress();
    });

    expect(mockSavePromptAnswer).toHaveBeenCalledWith(expect.objectContaining({
      promptId: expect.stringMatching(/^quiz:/),
      answer: 'They would choose coffee and a walk.',
      heatLevel: 1,
    }));

    const scopedKeys = getQuizCacheKeys('user-1:solo');
    expect(mockStorageSet).toHaveBeenCalledWith(
      scopedKeys.answer,
      'They would choose coffee and a walk.'
    );
    expect(mockStorageSet).not.toHaveBeenCalledWith(
      '@betweenus:cache:quizMyAnswer',
      expect.any(String)
    );
  });

  it('ignores legacy unscoped local answers from another signed-in account', async () => {
    const legacyKeys = new Set([
      '@betweenus:cache:quizDateKey',
      '@betweenus:cache:quizQuestionId',
      '@betweenus:cache:quizMyAnswer',
    ]);
    mockStorageGet.mockImplementation((key, fallback = null) => (
      Promise.resolve(legacyKeys.has(key) ? 'legacy-demo-value' : fallback)
    ));

    const navigation = createNavigation();
    const tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    expect(mockStorageGet).not.toHaveBeenCalledWith('@betweenus:cache:quizDateKey');
    expect(mockStorageGet).not.toHaveBeenCalledWith('@betweenus:cache:quizQuestionId');
    expect(mockStorageGet).not.toHaveBeenCalledWith('@betweenus:cache:quizMyAnswer');
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });

  it('lets a submitted Daily Quiz answer be edited', async () => {
    mockGetPromptAnswers.mockResolvedValue([
      { id: 'answer-1', answer: 'Original answer' },
    ]);

    const navigation = createNavigation();
    const tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const [editButton] = findTouchablesByText(tree.root, 'Edit');
    expect(editButton).toBeTruthy();

    await renderer.act(async () => {
      editButton.props.onPress();
    });

    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe('Original answer');
    expect(findTouchablesByText(tree.root, 'Lock In My Answer')[0]).toBeTruthy();
  });

  it('lets a submitted Daily Quiz answer be deleted without deleting past data', async () => {
    mockGetPromptAnswers.mockResolvedValue([
      { id: 'answer-1', answer: 'Original answer' },
    ]);

    const navigation = createNavigation();
    const tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const [deleteButton] = findTouchablesByText(tree.root, 'Delete');
    expect(deleteButton).toBeTruthy();

    await renderer.act(async () => {
      deleteButton.props.onPress();
    });

    const [, , actions] = mockAlert.mock.calls[mockAlert.mock.calls.length - 1];
    const deleteAction = actions.find((action) => action.text === 'Delete');

    await renderer.act(async () => {
      await deleteAction.onPress();
    });

    expect(mockDeletePromptAnswer).toHaveBeenCalledWith('answer-1');
    const scopedKeys = getQuizCacheKeys('user-1:solo');
    expect(mockStorageRemove).toHaveBeenCalledWith(scopedKeys.date);
    expect(mockStorageRemove).toHaveBeenCalledWith(scopedKeys.question);
    expect(mockStorageRemove).toHaveBeenCalledWith(scopedKeys.answer);
    expect(findTouchablesByText(tree.root, 'Lock In My Answer')[0]).toBeTruthy();
  });
});
