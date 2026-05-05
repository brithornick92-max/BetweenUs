const {
  resetScreenHarnessMocks,
} = require('../helpers/screenTestHarness');

jest.mock('../../services/ContentAccessService', () => ({
  __esModule: true,
  default: {
    getAccessiblePositions: jest.fn(),
  },
}));

jest.mock('../../services/WeeklyContentSetService', () => ({
  CONTENT_TYPES: { POSITIONS: 'positions' },
  buildWeeklySet: jest.fn(() => ({ items: [] })),
}));

jest.mock('../../services/PreferenceEngine', () => ({
  getContentProfile: jest.fn(),
}));

describe('core screen flow helpers', () => {
  beforeEach(() => {
    resetScreenHarnessMocks();
  });

  it('keeps a selected intimacy position by id when the positions array is rebuilt', () => {
    const { resolveSelectedPositionIndex } = require('../../screens/IntimacyPositionsScreen.jsx');

    const before = [
      { id: 'ip001', title: 'First' },
      { id: 'ip002', title: 'Selected' },
      { id: 'ip003', title: 'Third' },
    ];
    const afterRefresh = [
      { id: 'ip001', title: 'First refreshed' },
      { id: 'ip002', title: 'Selected refreshed' },
      { id: 'ip003', title: 'Third refreshed' },
    ];

    expect(resolveSelectedPositionIndex(before, {
      selectedPositionId: 'ip002',
      selectedIndex: 1,
    })).toBe(1);

    expect(resolveSelectedPositionIndex(afterRefresh, {
      selectedPositionId: 'ip002',
      selectedIndex: 0,
    })).toBe(1);
  });

  it('does not replace an empty weekly position set with the full catalog', () => {
    const { resolveAvailablePositions } = require('../../screens/IntimacyPositionsScreen.jsx');

    expect(resolveAvailablePositions(null)).toEqual([]);
    expect(resolveAvailablePositions({ items: [] })).toEqual([]);
    expect(resolveAvailablePositions({
      items: [{ id: 'ip001', title: 'Only weekly position' }],
    })).toEqual([{ id: 'ip001', title: 'Only weekly position' }]);
  });

  it('uses quiz-prefixed prompt ids for Daily Quiz answers', () => {
    const { getQuizPromptId } = require('../../screens/CouplesQuizScreen');

    expect(getQuizPromptId('quiz_best_weekend_start')).toBe('quiz:quiz_best_weekend_start');
  });
});
