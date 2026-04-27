/**
 * SoftBoundaries regression tests
 *
 * Covers the five boundary types:
 *   hideSpicy, maxHeatOverride, hiddenCategories, pausedEntries, pausedDates
 *
 * Critical regression: maxHeatOverride must use != null (not truthy) so that
 * a value of 0 is respected.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SoftBoundaries } from '../../services/PolishEngine';

const EMPTY = {
  hideSpicy: false,
  pausedDates: [],
  pausedEntries: [],
  hiddenCategories: [],
  maxHeatOverride: null,
};

const stored = (data) => JSON.stringify(data);

const makePrompt = (overrides = {}) => ({
  id: 'p1',
  heat: 1,
  category: 'romance',
  text: 'Test prompt',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: nothing in storage → _getAll returns EMPTY
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
});

// ─── shouldShowPrompt ───────────────────────────────────────────────────────

describe('SoftBoundaries.shouldShowPrompt', () => {
  it('shows prompt when all boundaries are empty', async () => {
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 3 }))).toBe(true);
  });

  it('hides prompt with heat >= 4 when hideSpicy is true', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      stored({ ...EMPTY, hideSpicy: true, maxHeatOverride: 3 })
    );
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 4 }))).toBe(false);
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 5 }))).toBe(false);
  });

  it('shows prompt with heat <= 3 when hideSpicy is true', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      stored({ ...EMPTY, hideSpicy: true, maxHeatOverride: 3 })
    );
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 3 }))).toBe(true);
  });

  it('respects maxHeatOverride: 2 — hides heat-3 prompts', async () => {
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY, maxHeatOverride: 2 }));
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 3 }))).toBe(false);
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 2 }))).toBe(true);
  });

  it('REGRESSION: maxHeatOverride: 0 must not be ignored (falsy check)', async () => {
    // A value of 0 means "show nothing" — must NOT be skipped by a truthy check
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY, maxHeatOverride: 0 }));
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 1 }))).toBe(false);
  });

  it('shows all prompts when maxHeatOverride is null', async () => {
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY, maxHeatOverride: null }));
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 5 }))).toBe(true);
  });

  it('hides prompt in a hidden category', async () => {
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY, hiddenCategories: ['kinky'] }));
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ category: 'kinky' }))).toBe(false);
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ category: 'romance' }))).toBe(true);
  });

  it('hides paused prompt by id', async () => {
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY, pausedEntries: ['p-secret'] }));
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ id: 'p-secret' }))).toBe(false);
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ id: 'p-other' }))).toBe(true);
  });

  it('returns true gracefully when storage throws', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('disk full'));
    // Error boundary defaults to all-clear, so content is still shown
    expect(await SoftBoundaries.shouldShowPrompt(makePrompt({ heat: 4 }))).toBe(true);
  });
});

// ─── shouldShowDate ─────────────────────────────────────────────────────────

describe('SoftBoundaries.shouldShowDate', () => {
  it('shows date when no dates are paused', async () => {
    expect(await SoftBoundaries.shouldShowDate('date-1')).toBe(true);
  });

  it('hides a paused date', async () => {
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY, pausedDates: ['date-hidden'] }));
    expect(await SoftBoundaries.shouldShowDate('date-hidden')).toBe(false);
    expect(await SoftBoundaries.shouldShowDate('date-other')).toBe(true);
  });
});

// ─── setHideSpicy ────────────────────────────────────────────────────────────

describe('SoftBoundaries.setHideSpicy', () => {
  it('sets hideSpicy true and caps maxHeatOverride at 3', async () => {
    AsyncStorage.getItem.mockResolvedValue(stored({ ...EMPTY }));
    await SoftBoundaries.setHideSpicy(true);

    const savedRaw = AsyncStorage.setItem.mock.calls[0][1];
    const data = JSON.parse(savedRaw);
    expect(data.hideSpicy).toBe(true);
    expect(data.maxHeatOverride).toBe(3);
  });

  it('clears maxHeatOverride when hideSpicy is turned off', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      stored({ ...EMPTY, hideSpicy: true, maxHeatOverride: 3 })
    );
    await SoftBoundaries.setHideSpicy(false);

    const savedRaw = AsyncStorage.setItem.mock.calls[0][1];
    const data = JSON.parse(savedRaw);
    expect(data.hideSpicy).toBe(false);
    expect(data.maxHeatOverride).toBeNull();
  });
});
