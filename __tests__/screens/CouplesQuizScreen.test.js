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
  mockSavePromptAnswer,
  mockStorageRemove,
  mockStorageSet,
} = require('../helpers/screenTestHarness');

const CouplesQuizScreen = require('../../screens/CouplesQuizScreen').default;

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

    expect(mockStorageSet).toHaveBeenCalledWith(
      '@betweenus:cache:quizMyAnswer',
      'They would choose coffee and a walk.'
    );
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
    expect(mockStorageRemove).toHaveBeenCalledWith('@betweenus:cache:quizDateKey');
    expect(mockStorageRemove).toHaveBeenCalledWith('@betweenus:cache:quizQuestionId');
    expect(mockStorageRemove).toHaveBeenCalledWith('@betweenus:cache:quizMyAnswer');
    expect(findTouchablesByText(tree.root, 'Lock In My Answer')[0]).toBeTruthy();
  });
});
