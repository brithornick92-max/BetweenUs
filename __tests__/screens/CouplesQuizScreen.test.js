const {
  TextInput,
  renderer,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockSavePromptAnswer,
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
});
