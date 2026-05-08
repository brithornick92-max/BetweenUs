const {
  TextInput,
  renderer,
  flushEffects,
  renderScreen,
  createNavigation,
  findTouchablesByText,
  resetScreenHarnessMocks,
  mockDeletePromptAnswer,
  mockGetSharedDailyQuizQuestionSelection,
  mockGetPromptAnswers,
  mockGetSharedPromptAnswers,
  mockRevealPromptAnswer,
  mockAlert,
  mockStorageGet,
  mockSavePromptAnswer,
  mockStorageRemove,
  mockStorageSet,
  setAppContextMock,
} = require('../helpers/screenTestHarness');

const CouplesQuizModule = require('../../screens/CouplesQuizScreen');
const CouplesQuizScreen = CouplesQuizModule.default;
const { getDailyQuestion, getQuizAnswerCacheKey, getQuizCacheKeys } = CouplesQuizModule;
const { getDailyContentDateKey } = require('../../utils/dailyContentDate');
const { MINIMUM_QUESTION_REPEAT_DAYS } = require('../../utils/noRepeatContentRotation');
const { Text } = require('react-native');

function flattenText(children) {
  if (Array.isArray(children)) {
    return children.map(flattenText).join('');
  }
  if (children === null || children === undefined) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  return '';
}

function getRenderedText(root) {
  return root
    .findAllByType(Text)
    .map((node) => flattenText(node.props.children))
    .filter(Boolean);
}

describe('CouplesQuizScreen', () => {
  let tree;

  beforeEach(() => {
    resetScreenHarnessMocks();
    mockStorageGet.mockImplementation((_key, fallback = null) => Promise.resolve(fallback));
  });

  afterEach(() => {
    tree?.unmount();
    tree = null;
  });

  it('saves Daily Quiz answers through the prompt-answer path', async () => {
    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
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

    const todayKey = getDailyContentDateKey();
    const scopedKeys = getQuizCacheKeys('user-1:solo');
    const answerKey = getQuizAnswerCacheKey('user-1:solo', todayKey, getDailyQuestion(todayKey).id);

    expect(mockStorageSet).toHaveBeenCalledWith(
      answerKey,
      'They would choose coffee and a walk.'
    );
    expect(mockStorageSet).not.toHaveBeenCalledWith(
      scopedKeys.answer,
      expect.any(String)
    );
    expect(mockStorageSet).not.toHaveBeenCalledWith(
      '@betweenus:cache:quizMyAnswer',
      expect.any(String)
    );
  });

  it('lets solo users review a saved Daily Quiz answer without waiting for a partner', async () => {
    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const input = tree.root.findByType(TextInput);
    await renderer.act(async () => {
      input.props.onChangeText('They would choose coffee and a walk.');
    });

    const [submitButton] = findTouchablesByText(tree.root, 'Lock In My Answer');
    await renderer.act(async () => {
      await submitButton.props.onPress();
    });

    const [reviewButton] = findTouchablesByText(tree.root, 'Review My Answer');
    expect(reviewButton).toBeTruthy();

    await renderer.act(async () => {
      reviewButton.props.onPress();
    });

    const renderedText = getRenderedText(tree.root);
    expect(renderedText).toContain('Your answer');
    expect(renderedText).toContain('Link your partner later to reveal both sides on future quizzes.');
    expect(mockAlert).not.toHaveBeenCalledWith(
      expect.stringContaining('Waiting for'),
      expect.any(String),
      expect.any(Array)
    );
  });

  it('does not render the Daily Quiz category label', async () => {
    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const categoryLabels = new Set(
      require('../../content/quizQuestions.json').questions.map((question) =>
        String(question.category || '').toUpperCase()
      )
    );
    const renderedCategoryLabels = tree.root.findAll((node) =>
      typeof node.props?.children === 'string' && categoryLabels.has(node.props.children)
    );

    expect(renderedCategoryLabels).toHaveLength(0);
  });

  it('keeps one Daily Quiz question until the 4am content rollover', () => {
    const beforeRolloverKey = getDailyContentDateKey(new Date(2026, 4, 5, 3, 59, 59));
    const previousEveningKey = getDailyContentDateKey(new Date(2026, 4, 4, 23, 0, 0));
    const afterRolloverKey = getDailyContentDateKey(new Date(2026, 4, 5, 4, 0, 0));

    expect(beforeRolloverKey).toBe(previousEveningKey);
    expect(afterRolloverKey).toBe('2026-05-05');
    expect(getDailyQuestion(beforeRolloverKey).id).toBe(getDailyQuestion(previousEveningKey).id);
    expect(getDailyQuestion(afterRolloverKey).id).not.toBe(getDailyQuestion(beforeRolloverKey).id);
  });

  it('uses every Daily Quiz question before repeating the rotation', () => {
    const questions = require('../../content/quizQuestions.json').questions;
    const seenQuestionIds = new Set();
    const firstSixMonthIds = new Set();

    for (let offset = 0; offset < questions.length; offset += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + offset));
      const dateKey = date.toISOString().slice(0, 10);
      const questionId = getDailyQuestion(dateKey).id;
      seenQuestionIds.add(questionId);
      if (offset < MINIMUM_QUESTION_REPEAT_DAYS) {
        firstSixMonthIds.add(questionId);
      }
    }

    const repeatDate = new Date(Date.UTC(2026, 0, 1 + questions.length));
    const repeatDateKey = repeatDate.toISOString().slice(0, 10);

    expect(seenQuestionIds.size).toBe(questions.length);
    expect(firstSixMonthIds.size).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
    expect(getDailyQuestion(repeatDateKey).id).toBe(getDailyQuestion('2026-01-01').id);
  });

  it('keeps a cached Daily Quiz question fixed for the current 4am app day', async () => {
    const navigation = createNavigation();
    const todayKey = getDailyContentDateKey();
    const questions = require('../../content/quizQuestions.json').questions;
    const deterministicQuestion = getDailyQuestion(todayKey);
    const cachedQuestion = questions.find((question) => question.id !== deterministicQuestion.id);
    const scopedKeys = getQuizCacheKeys('user-1:solo');

    mockStorageGet.mockImplementation((key, fallback = null) => {
      if (key === scopedKeys.date) return Promise.resolve(todayKey);
      if (key === scopedKeys.question) return Promise.resolve(cachedQuestion.id);
      return Promise.resolve(fallback);
    });

    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();
    await flushEffects();

    const renderedText = getRenderedText(tree.root);
    expect(renderedText).toContain(cachedQuestion.text.replace(/\{partner\}/g, 'your partner'));
  });

  it('uses the shared Daily Quiz question before linked local cache', async () => {
    const navigation = createNavigation();
    const todayKey = getDailyContentDateKey();
    const questions = require('../../content/quizQuestions.json').questions;
    const deterministicQuestion = getDailyQuestion(todayKey);
    const sharedQuestion = questions.find((question) => question.id !== deterministicQuestion.id);
    const scopedKeys = getQuizCacheKeys('user-1:couple-1');

    setAppContextMock({ userId: 'user-1', coupleId: 'couple-1' });
    mockGetSharedDailyQuizQuestionSelection.mockResolvedValue({
      value: { questionId: sharedQuestion.id },
    });
    mockStorageGet.mockImplementation((key, fallback = null) => {
      if (key === scopedKeys.date) return Promise.resolve(todayKey);
      if (key === scopedKeys.question) return Promise.resolve(deterministicQuestion.id);
      return Promise.resolve(fallback);
    });

    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();
    await flushEffects();

    const renderedText = getRenderedText(tree.root);
    expect(renderedText).toContain(sharedQuestion.text.replace(/\{partner\}/g, 'your partner'));
    expect(mockGetSharedDailyQuizQuestionSelection).toHaveBeenCalledWith(
      todayKey,
      expect.objectContaining({ fallbackCoupleId: 'couple-1' })
    );
    expect(mockStorageSet).toHaveBeenCalledWith(scopedKeys.question, sharedQuestion.id);
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
    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    expect(mockStorageGet).not.toHaveBeenCalledWith('@betweenus:cache:quizDateKey');
    expect(mockStorageGet).not.toHaveBeenCalledWith('@betweenus:cache:quizQuestionId');
    expect(mockStorageGet).not.toHaveBeenCalledWith('@betweenus:cache:quizMyAnswer');
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });

  it('ignores cached prompt answers that do not match the Daily Quiz prompt', async () => {
    mockGetSharedPromptAnswers.mockResolvedValue([
      {
        id: 'prompt-answer-1',
        prompt_id: 'h1_001',
        date_key: '2026-05-01',
        answer: 'Unrelated prompt answer',
        partnerAnswer: 'Unrelated partner answer',
      },
    ]);

    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe('');
    expect(findTouchablesByText(tree.root, 'Lock In My Answer')[0]).toBeTruthy();
  });

  it("does not reuse yesterday's unqualified local answer for today's quiz", async () => {
    const todayKey = getDailyContentDateKey();
    const todayQuestion = getDailyQuestion(todayKey);
    const scopedKeys = getQuizCacheKeys('user-1:solo');

    mockStorageGet.mockImplementation((key, fallback = null) => {
      if (key === scopedKeys.date) return Promise.resolve(todayKey);
      if (key === scopedKeys.question) return Promise.resolve(todayQuestion.id);
      if (key === scopedKeys.answer) return Promise.resolve("Yesterday's answer");
      return Promise.resolve(fallback);
    });

    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();
    await flushEffects();

    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe('');
    expect(findTouchablesByText(tree.root, 'Lock In My Answer')[0]).toBeTruthy();
  });

  it('lets a submitted Daily Quiz answer be edited', async () => {
    mockGetPromptAnswers.mockImplementation(({ dateKey, promptId }) => Promise.resolve([
      { id: 'answer-1', prompt_id: promptId, date_key: dateKey, answer: 'Original answer' },
    ]));

    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
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
    mockGetPromptAnswers.mockImplementation(({ dateKey, promptId }) => Promise.resolve([
      { id: 'answer-1', prompt_id: promptId, date_key: dateKey, answer: 'Original answer' },
    ]));

    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
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
    expect(mockStorageRemove).not.toHaveBeenCalledWith(scopedKeys.date);
    expect(mockStorageRemove).not.toHaveBeenCalledWith(scopedKeys.question);
    expect(mockStorageRemove).toHaveBeenCalledWith(scopedKeys.answer);
    expect(findTouchablesByText(tree.root, 'Lock In My Answer')[0]).toBeTruthy();
  });

  it('labels the reveal as reciprocal guesses, not partner self-answers', async () => {
    mockGetSharedPromptAnswers.mockImplementation(({ dateKey, promptId }) => Promise.resolve([
      {
        id: 'answer-1',
        prompt_id: promptId,
        date_key: dateKey,
        answer: 'They would choose coffee and a walk.',
        partnerAnswer: 'You would choose dinner and dancing.',
        partnerHasAnswered: true,
        is_revealed: true,
      },
    ]));
    mockRevealPromptAnswer.mockResolvedValue({
      id: 'answer-1',
      partnerAnswer: 'You would choose dinner and dancing.',
      partnerHasAnswered: true,
      is_revealed: true,
    });

    const navigation = createNavigation();
    tree = await renderScreen(CouplesQuizScreen, { navigation });
    await flushEffects();

    const [revealButton] = findTouchablesByText(tree.root, 'Reveal Both Answers');
    expect(revealButton).toBeTruthy();

    await renderer.act(async () => {
      revealButton.props.onPress();
    });

    const renderedText = getRenderedText(tree.root);
    expect(renderedText).toContain('You guessed about your partner');
    expect(renderedText).toContain('your partner guessed about you');
    expect(renderedText).toContain('Compare the guesses and fill in the real answers together.');
    expect(renderedText).not.toContain('your partner said');
  });
});
