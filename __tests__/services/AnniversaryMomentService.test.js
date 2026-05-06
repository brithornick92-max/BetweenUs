import {
  buildAnniversaryCalendarEvent,
  getAnniversaryYearsTogether,
  getEventsForDateWithAnniversary,
  isAnniversaryDay,
  markAnniversaryPopupSeen,
  shouldShowAnniversaryPopup,
} from '../../services/AnniversaryMomentService';

describe('AnniversaryMomentService', () => {
  it('detects anniversary day after the first year', () => {
    expect(isAnniversaryDay('2024-04-29T00:00:00.000Z', new Date(2026, 3, 29))).toBe(true);
    expect(isAnniversaryDay('2026-04-29T00:00:00.000Z', new Date(2026, 3, 29))).toBe(false);
    expect(isAnniversaryDay('2024-04-29T00:00:00.000Z', new Date(2026, 3, 30))).toBe(false);
  });

  it('treats anniversary values as calendar dates instead of timezone-shifted instants', () => {
    expect(isAnniversaryDay('2024-04-29T23:30:00.000-05:00', new Date(2026, 3, 29))).toBe(true);
    expect(isAnniversaryDay('2024-04-29', new Date(2026, 3, 29))).toBe(true);
  });

  it('calculates years together using month and day', () => {
    expect(getAnniversaryYearsTogether('2024-05-10T00:00:00.000Z', new Date(2026, 4, 9))).toBe(1);
    expect(getAnniversaryYearsTogether('2024-05-10T00:00:00.000Z', new Date(2026, 4, 10))).toBe(2);
  });

  it('builds a generated calendar anniversary for the selected year', () => {
    const event = buildAnniversaryCalendarEvent('2024-04-29T00:00:00.000Z', new Date(2026, 0, 1));

    expect(event).toMatchObject({
      id: 'generated_anniversary_2026',
      title: 'Your 2nd anniversary',
      eventType: 'anniversary',
      isGeneratedAnniversary: true,
    });
    expect(new Date(event.whenTs).getFullYear()).toBe(2026);
    expect(new Date(event.whenTs).getMonth()).toBe(3);
    expect(new Date(event.whenTs).getDate()).toBe(29);
  });

  it('adds the generated anniversary only when no anniversary event exists that day', () => {
    const selectedDate = new Date(2026, 3, 29);
    const regularEvents = [{ id: 'event-1', title: 'Dinner', whenTs: selectedDate.getTime(), eventType: 'dateNight' }];
    const withGenerated = getEventsForDateWithAnniversary(
      regularEvents,
      selectedDate,
      '2024-04-29T00:00:00.000Z'
    );

    expect(withGenerated.map((event) => event.id)).toEqual(['event-1', 'generated_anniversary_2026']);

    const storedAnniversary = [{ id: 'event-2', title: 'Stored', whenTs: selectedDate.getTime(), eventType: 'anniversary' }];
    const withoutDuplicate = getEventsForDateWithAnniversary(
      storedAnniversary,
      selectedDate,
      '2024-04-29T00:00:00.000Z'
    );

    expect(withoutDuplicate.map((event) => event.id)).toEqual(['event-2']);
  });

  it('shows and records the popup once per anniversary year', async () => {
    const values = {};
    const storageApi = {
      get: jest.fn((key, fallback) => Promise.resolve(values[key] ?? fallback)),
      set: jest.fn((key, value) => {
        values[key] = value;
        return Promise.resolve(true);
      }),
    };

    const moment = await shouldShowAnniversaryPopup('2024-04-29T00:00:00.000Z', {
      today: new Date(2026, 3, 29),
      storageApi,
    });

    expect(moment).toMatchObject({
      yearsTogether: 2,
      title: 'Happy anniversary',
      message: '2 years of choosing each other.',
    });

    await markAnniversaryPopupSeen(moment.key, { storageApi });
    await expect(shouldShowAnniversaryPopup('2024-04-29T00:00:00.000Z', {
      today: new Date(2026, 3, 29),
      storageApi,
    })).resolves.toBeNull();
  });
});
