const promptsCatalog = require('../../content/prompts.json');
const datesCatalog = require('../../content/dates.json');
const positionsCatalog = require('../../content/intimacy-positions.json');
const todayPromptsCatalog = require('../../content/today-between-us-prompts.json');

const {
  getDailyContentDateKey,
  getMsUntilNextDailyContentRollover,
  getNextDailyContentRollover,
} = require('../../utils/dailyContentDate');
const {
  dateOnlyToLocalDate,
  formatLocalDateKey,
  isFutureLocalDate,
  normalizeDateOnlyKey,
} = require('../../utils/dateOnly');
const {
  MINIMUM_QUESTION_REPEAT_DAYS,
  getNoRepeatRotationIndex,
  getNoRepeatRotationItem,
  getNoRepeatWindowStatus,
  stableStringHash,
} = require('../../utils/noRepeatContentRotation');
const {
  getTodayBetweenUsRotationPool,
  selectTodayBetweenUsPrompt,
} = require('../../utils/todayBetweenUsRotation');
const {
  buildHeatLevelRangePreference,
  getHeatLevelRangePresetForProfile,
  hasExplicitHeatLevelFilter,
  normalizeHeatLevel,
  normalizeHeatLevels,
  profileAllowsHeatLevel,
} = require('../../utils/heatLevelRanges');

const DeepLinkHandler = require('../../services/DeepLinkHandler').default;

const uniqueCount = (items) => new Set(items).size;

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('full behavior logic audit regressions', () => {
  describe('daily date source of truth', () => {
    it('keeps pre-rollover app opens on the previous local content day', () => {
      expect(getDailyContentDateKey(new Date(2026, 4, 10, 3, 59))).toBe('2026-05-09');
    });

    it('moves to the current local content day at the rollover hour', () => {
      expect(getDailyContentDateKey(new Date(2026, 4, 10, 4, 0))).toBe('2026-05-10');
    });

    it('defaults invalid rollover hours back to the configured 4am boundary', () => {
      expect(getDailyContentDateKey(new Date(2026, 4, 10, 3, 30), 99)).toBe('2026-05-09');
    });

    it('returns the same-day rollover while the app is open before 4am', () => {
      const next = getNextDailyContentRollover(new Date(2026, 4, 10, 2, 15));

      expect(formatLocalDateKey(next)).toBe('2026-05-10');
      expect(next.getHours()).toBe(4);
    });

    it('returns the next-day rollover after the current day has already rolled', () => {
      const now = new Date(2026, 4, 10, 6, 0);
      const next = getNextDailyContentRollover(now);

      expect(formatLocalDateKey(next)).toBe('2026-05-11');
      expect(getMsUntilNextDailyContentRollover(now)).toBe(22 * 60 * 60 * 1000);
    });
  });

  describe('date-only normalization', () => {
    it('preserves explicit date components from server timestamp strings', () => {
      expect(normalizeDateOnlyKey('2026-05-10T23:59:59.999Z')).toBe('2026-05-10');
    });

    it('trims date-only values before normalization', () => {
      expect(normalizeDateOnlyKey(' 2026-05-10 ')).toBe('2026-05-10');
    });

    it('rejects impossible calendar dates instead of rolling them forward', () => {
      expect(normalizeDateOnlyKey('2026-02-30')).toBeNull();
    });

    it('creates local noon dates by default for date-only values', () => {
      const date = dateOnlyToLocalDate('2026-05-10');

      expect(formatLocalDateKey(date)).toBe('2026-05-10');
      expect(date.getHours()).toBe(12);
      expect(date.getMinutes()).toBe(0);
    });

    it('supports custom local times for date-only values', () => {
      const date = dateOnlyToLocalDate('2026-05-10', { hour: 9, minute: 30 });

      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(30);
    });

    it('detects future local dates by date key rather than UTC instant', () => {
      expect(isFutureLocalDate('2026-05-11', new Date(2026, 4, 10, 23, 30))).toBe(true);
    });

    it('does not treat today or past local dates as future', () => {
      const now = new Date(2026, 4, 10, 23, 30);

      expect(isFutureLocalDate('2026-05-10', now)).toBe(false);
      expect(isFutureLocalDate('2026-05-09', now)).toBe(false);
    });
  });

  describe('no-repeat rotation guarantees', () => {
    it('hashes the same string to the same value every time', () => {
      expect(stableStringHash('couple:one:2026-05-10')).toBe(stableStringHash('couple:one:2026-05-10'));
    });

    it('hashes nearby strings to different values for seed separation', () => {
      expect(stableStringHash('couple:one')).not.toBe(stableStringHash('couple:two'));
    });

    it('returns -1 when no items are available to rotate', () => {
      expect(getNoRepeatRotationIndex('2026-05-10', 0)).toBe(-1);
    });

    it('wraps dates before the rotation anchor into the valid index range', () => {
      const index = getNoRepeatRotationIndex('2025-12-31', 10);

      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(10);
    });

    it('returns a stable index for the same date and seed', () => {
      const options = { seed: 'couple:stable' };

      expect(getNoRepeatRotationIndex('2026-05-10', 183, options)).toBe(
        getNoRepeatRotationIndex('2026-05-10', 183, options)
      );
    });

    it('keeps the current cycle stable when future content is appended', () => {
      const options = { seed: 'couple:stable', stableCycleSize: 5 };

      expect(getNoRepeatRotationIndex('2026-05-10', 5, options)).toBe(
        getNoRepeatRotationIndex('2026-05-10', 10, options)
      );
    });

    it('ignores empty list entries before selecting a rotation item', () => {
      expect(getNoRepeatRotationItem([null, { id: 'only' }, undefined], '2026-05-10')).toEqual({ id: 'only' });
    });

    it('reports that the Today Between Us pool can satisfy the six-month no-repeat window', () => {
      expect(getNoRepeatWindowStatus(todayPromptsCatalog.items).canGuarantee).toBe(true);
      expect(getNoRepeatWindowStatus(todayPromptsCatalog.items).uniqueCount).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
    });

    it('reports when duplicate or undersized pools cannot guarantee the requested window', () => {
      const status = getNoRepeatWindowStatus([{ id: 'a' }, { id: 'a' }, { id: 'b' }], { minRepeatDays: 3 });

      expect(status.canGuarantee).toBe(false);
      expect(status.uniqueCount).toBe(2);
    });
  });

  describe('Today Between Us assignment pool', () => {
    it('filters the daily rotation pool to heat levels 1 through 3', () => {
      const pool = getTodayBetweenUsRotationPool([
        { id: 'h1', heat: 1, text: 'one' },
        { id: 'h4', heat: 4, text: 'four' },
        { id: 'h5', heat: 5, text: 'five' },
      ]);

      expect(pool.map((item) => item.id)).toEqual(['h1']);
    });

    it('sorts within heat buckets before interleaving intensity levels', () => {
      const pool = getTodayBetweenUsRotationPool([
        { id: 'h1-b', heat: 1, text: 'one b' },
        { id: 'h2-a', heat: 2, text: 'two a' },
        { id: 'h1-a', heat: 1, text: 'one a' },
        { id: 'h3-a', heat: 3, text: 'three a' },
      ]);

      expect(pool.map((item) => item.id)).toEqual(['h1-a', 'h2-a', 'h3-a', 'h1-b']);
    });

    it('does not select malformed daily prompts with missing ids or empty text', () => {
      expect(selectTodayBetweenUsPrompt([{ id: 'bad', heat: 1, text: '' }], '2026-05-10')).toBeNull();
    });

    it('returns the same prompt for the same scope and date', () => {
      const first = selectTodayBetweenUsPrompt(todayPromptsCatalog.items, '2026-05-10', 'couple:one');
      const second = selectTodayBetweenUsPrompt(todayPromptsCatalog.items, '2026-05-10', 'couple:one');

      expect(second.id).toBe(first.id);
    });

    it('always selects a valid dedicated daily prompt from the production catalog', () => {
      const prompt = selectTodayBetweenUsPrompt(todayPromptsCatalog.items, '2026-05-10', 'couple:catalog');

      expect(prompt.dailyOnly).toBe(true);
      expect(prompt.heat).toBeGreaterThanOrEqual(1);
      expect(prompt.heat).toBeLessThanOrEqual(3);
      expect(typeof prompt.text).toBe('string');
    });
  });

  describe('heat and content preference logic', () => {
    it('clamps heat values above the supported range', () => {
      expect(normalizeHeatLevel(8)).toBe(5);
    });

    it('clamps heat values below the supported range', () => {
      expect(normalizeHeatLevel(0)).toBe(1);
    });

    it('floors decimal heat values', () => {
      expect(normalizeHeatLevel(2.9)).toBe(2);
    });

    it('deduplicates and sorts heat level arrays', () => {
      expect(normalizeHeatLevels([3, '2', 2, 5, 9, 0, null])).toEqual([1, 2, 3, 5]);
    });

    it('resolves heat range presets from nested profile preferences', () => {
      expect(getHeatLevelRangePresetForProfile({ preferences: { heatLevelRangeId: 'gentle' } }).id).toBe('gentle');
    });

    it('maps legacy max-heat profiles to a safe gentle preset', () => {
      expect(getHeatLevelRangePresetForProfile({ heatLevelPreference: 3 }).id).toBe('gentle');
    });

    it('lets explicit heat levels override preset labels', () => {
      const profile = { heatLevelRangeId: 'everything', allowedHeatLevels: [2] };

      expect(profileAllowsHeatLevel(profile, 1)).toBe(false);
      expect(profileAllowsHeatLevel(profile, 2)).toBe(true);
    });

    it('builds high-heat preferences with matching allowed levels and max heat', () => {
      expect(buildHeatLevelRangePreference('high_heat')).toMatchObject({
        heatLevelRangeId: 'high_heat',
        allowedHeatLevels: [3, 4, 5],
        heatLevelPreference: 5,
      });
    });

    it('distinguishes default profiles from explicit heat-filtered profiles', () => {
      expect(hasExplicitHeatLevelFilter({})).toBe(false);
      expect(hasExplicitHeatLevelFilter({ heatLevelRangeId: 'balanced' })).toBe(true);
    });
  });

  describe('deep link and notification payload safety', () => {
    let navigate;

    beforeEach(() => {
      jest.clearAllMocks();
      navigate = jest.fn();
      DeepLinkHandler.setNavigationRef({
        isReady: () => true,
        navigate,
      });
      DeepLinkHandler.setShowSecondaryTabs(true);
    });

    it('builds notification data with only safe ids and date keys', () => {
      expect(DeepLinkHandler.buildNotificationData('prompt', {
        promptId: 'h2_042',
        dateKey: '2026-05-10',
      })).toEqual({
        route: 'prompt',
        id: 'h2_042',
        dateKey: '2026-05-10',
        url: 'betweenus://prompt/h2_042?dateKey=2026-05-10',
      });
    });

    it('drops private or arbitrary notification fields from generated payloads', () => {
      const data = DeepLinkHandler.buildNotificationData('prompt', {
        promptId: 'h2_042',
        answer: 'private answer',
        title: 'private title',
        routeParams: { answer: 'private answer' },
      });

      expect(data).toEqual({
        route: 'prompt',
        id: 'h2_042',
        url: 'betweenus://prompt/h2_042',
      });
      expect(data.answer).toBeUndefined();
      expect(data.title).toBeUndefined();
      expect(data.routeParams).toBeUndefined();
    });

    it('rejects unsafe ids and invalid date keys in generated payloads', () => {
      expect(DeepLinkHandler.buildNotificationData('prompt', {
        promptId: 'bad/id',
        dateKey: 'tomorrow',
      })).toEqual({
        route: 'prompt',
        url: 'betweenus://prompt',
      });
    });

    it('reads stringified nested notification params without passing arbitrary fields through', () => {
      const handled = DeepLinkHandler.handleNotificationResponse({
        notification: {
          request: {
            content: {
              data: {
                route: 'prompt',
                params: JSON.stringify({ id: 'p-777', dateKey: '2026-05-10', answer: 'private' }),
              },
            },
          },
        },
      });

      expect(handled).toBe(true);
      expect(navigate).toHaveBeenCalledWith('PromptAnswer', {
        promptId: 'p-777',
        dateKey: '2026-05-10',
      });
    });

    it('passes only route-safe prompt params from notification payloads', () => {
      const handled = DeepLinkHandler.handleNotificationResponse({
        notification: {
          request: {
            content: {
              data: {
                route: 'prompt',
                id: 'p-1',
                answer: 'private answer',
                title: 'private title',
                dateKey: 'not-a-date',
              },
            },
          },
        },
      });

      expect(handled).toBe(true);
      expect(navigate).toHaveBeenCalledWith('PromptAnswer', { promptId: 'p-1' });
    });

    it('routes typed vibe notifications to the vibe screen without needing raw route params', () => {
      const handled = DeepLinkHandler.handleNotificationResponse({
        notification: {
          request: {
            content: {
              data: { type: 'vibe_sent', vibeLabel: 'private mood' },
            },
          },
        },
      });

      expect(handled).toBe(true);
      expect(navigate).toHaveBeenCalledWith('VibeSignal', {});
    });

    it('falls back to safe URLs when an unknown notification route is present', () => {
      const handled = DeepLinkHandler.handleNotificationResponse({
        notification: {
          request: {
            content: {
              data: { route: 'legacy-route', url: 'betweenus://calendar' },
            },
          },
        },
      });

      expect(handled).toBe(true);
      expect(navigate).toHaveBeenCalledWith('MainTabs', { screen: 'Calendar' });
    });

    it('rejects deep links with extra path segments for id-required routes', () => {
      expect(DeepLinkHandler.handleUrl('betweenus://prompt/p-1/extra')).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('falls back to the home tabs when secondary tabs are not mounted yet', () => {
      DeepLinkHandler.setShowSecondaryTabs(false);

      expect(DeepLinkHandler.handleUrl('betweenus://date-ideas')).toBe(true);
      expect(navigate).toHaveBeenCalledWith('MainTabs', {});
    });

    it('does not handle notification taps before navigation is ready', () => {
      DeepLinkHandler.setNavigationRef({
        isReady: () => false,
        navigate,
      });

      expect(DeepLinkHandler.handleNotificationResponse({
        notification: {
          request: {
            content: {
              data: { route: 'vibe' },
            },
          },
        },
      })).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('production content catalog invariants', () => {
    it('keeps the main prompt catalog count and normalized text uniqueness aligned', () => {
      const normalizedTexts = promptsCatalog.items.map((item) => normalizeText(item.text));

      expect(promptsCatalog.meta.totalPrompts).toBe(promptsCatalog.items.length);
      expect(uniqueCount(normalizedTexts)).toBe(promptsCatalog.items.length);
    });

    it('keeps the daily prompt catalog large enough for the no-repeat window', () => {
      const ids = todayPromptsCatalog.items.map((item) => item.id);

      expect(todayPromptsCatalog.meta.totalPrompts).toBe(todayPromptsCatalog.items.length);
      expect(todayPromptsCatalog.items.length).toBe(MINIMUM_QUESTION_REPEAT_DAYS);
      expect(uniqueCount(ids)).toBe(todayPromptsCatalog.items.length);
    });

    it('keeps date catalog totals and ids aligned', () => {
      const ids = datesCatalog.items.map((item) => item.id);

      expect(datesCatalog.meta.totalDates).toBe(datesCatalog.items.length);
      expect(uniqueCount(ids)).toBe(datesCatalog.items.length);
    });

    it('keeps every date detail actionable with steps and guided instructions', () => {
      const incompleteDates = datesCatalog.items.filter((item) =>
        !Array.isArray(item.steps)
        || item.steps.length < 3
        || !Array.isArray(item.guidedSteps)
        || item.guidedSteps.length < 3
      );

      expect(incompleteDates).toEqual([]);
    });

    it('keeps every intimacy position detail renderable with core instruction copy', () => {
      const incompletePositions = positionsCatalog.items.filter((item) =>
        typeof item.focus !== 'string'
        || item.focus.trim().length < 20
        || typeof item.howTo !== 'string'
        || item.howTo.trim().length < 20
        || typeof item.benefits !== 'string'
        || item.benefits.trim().length < 20
      );

      expect(positionsCatalog.meta.totalPositions).toBe(positionsCatalog.items.length);
      expect(incompletePositions).toEqual([]);
    });
  });
});
