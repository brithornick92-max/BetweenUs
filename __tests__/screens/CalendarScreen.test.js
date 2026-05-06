require('../helpers/screenTestHarness');

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../../context/DataContext', () => ({
  useData: () => ({ isReady: true }),
}));

const {
  buildCalendarEventPayload,
  combineCalendarDateTime,
  getCalendarSaveBlockReason,
  getCalendarSaveErrorMessage,
} = require('../../screens/CalendarScreen');

describe('CalendarScreen logic helpers', () => {
  it('combines the picked date with the picked time', () => {
    const combined = combineCalendarDateTime(
      new Date(2026, 4, 5, 0, 0),
      new Date(2026, 0, 1, 19, 45)
    );

    expect(combined.getFullYear()).toBe(2026);
    expect(combined.getMonth()).toBe(4);
    expect(combined.getDate()).toBe(5);
    expect(combined.getHours()).toBe(19);
    expect(combined.getMinutes()).toBe(45);
  });

  it('assigns a stable id before saving new calendar events', () => {
    const payload = buildCalendarEventPayload({
      form: {
        title: ' Dinner downtown ',
        location: 'Main St',
        notes: 'Try the new place.',
        eventType: 'dateNight',
        isDateNight: true,
        notify: true,
        notifyMins: 60,
      },
      pickerDate: new Date(2026, 4, 5, 0, 0),
      pickerTime: new Date(2026, 0, 1, 19, 30),
      notificationId: 'notif-1',
      eventId: 'calendar-event-1',
    });

    expect(payload).toEqual(expect.objectContaining({
      id: 'calendar-event-1',
      title: 'Dinner downtown',
      eventType: 'dateNight',
      isDateNight: true,
      notify: true,
      notificationId: 'notif-1',
    }));
  });

  it('blocks calendar saves until the data layer is ready', () => {
    expect(getCalendarSaveBlockReason({
      title: 'Dinner',
      dataReady: false,
    })).toEqual({
      title: 'Syncing',
      message: 'Your calendar is still getting ready. Please try again in a moment.',
    });

    expect(getCalendarSaveBlockReason({
      title: 'Dinner',
      dataReady: true,
    })).toBeNull();
  });

  it('maps calendar save setup and policy failures to actionable messages', () => {
    expect(getCalendarSaveErrorMessage(new Error('Not configured for calendar')))
      .toBe('Your calendar is still connecting. Please try again in a moment.');

    expect(getCalendarSaveErrorMessage({ code: '42501', message: 'violates row-level security policy' }))
      .toBe("We couldn't sync this calendar event yet. Please try again in a moment.");
  });
});
