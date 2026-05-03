const mockSchedule = jest.fn().mockResolvedValue('connection-reminder-id');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
const AsyncStorage = require('@react-native-async-storage/async-storage');

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mockSchedule,
  cancelScheduledNotificationAsync: mockCancel,
  getPermissionsAsync: mockGetPermissions,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const {
  CONNECTION_REMINDER_TYPES,
  CONNECTION_REMINDER_TEMPLATES,
  formatConnectionReminderTime,
  getReminderOccurrences,
  normalizeConnectionReminderTime,
  normalizeConnectionReminderSettings,
  scheduleConnectionReminders,
} = require('../../services/ConnectionReminderService');

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockResolvedValue(undefined);
});

describe('ConnectionReminderService', () => {
  it('normalizes new reminder settings to disabled by default', () => {
    const normalized = normalizeConnectionReminderSettings({});

    expect(normalized.prompt.enabled).toBe(false);
    expect(normalized.prompt.frequency).toBe(CONNECTION_REMINDER_TEMPLATES.prompt.defaultFrequency);
    expect(normalized.intimacy.enabled).toBe(false);
  });

  it('accepts exact reminder times instead of only presets', () => {
    const normalized = normalizeConnectionReminderSettings({
      [CONNECTION_REMINDER_TYPES.PROMPT]: {
        enabled: true,
        frequency: 'daily',
        time: '7:05',
      },
      [CONNECTION_REMINDER_TYPES.JOURNAL]: {
        enabled: true,
        frequency: 'weekly',
        time: '23:59',
      },
    });

    expect(normalized.prompt.time).toBe('07:05');
    expect(normalized.journal.time).toBe('23:59');
    expect(normalizeConnectionReminderTime('25:99', '20:30')).toBe('20:30');
    expect(formatConnectionReminderTime('00:07')).toBe('12:07 AM');
    expect(formatConnectionReminderTime('23:59')).toBe('11:59 PM');
  });

  it('builds occurrences at the exact selected minute', () => {
    const occurrences = getReminderOccurrences(
      { enabled: true, frequency: 'daily', time: '07:05' },
      new Date('2026-05-03T06:00:00')
    );

    expect(occurrences[0].getHours()).toBe(7);
    expect(occurrences[0].getMinutes()).toBe(5);
  });

  it('schedules enabled reminders with Between Us copy and safe routes', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('notificationSettings')) {
        return JSON.stringify({
          notificationsEnabled: true,
          connectionReminders: {
            [CONNECTION_REMINDER_TYPES.DATE_IDEA]: {
              enabled: true,
              frequency: 'weekly',
              dayOfWeek: 5,
              time: '12:30',
            },
          },
        });
      }
      return null;
    });

    const ids = await scheduleConnectionReminders();

    expect(ids).toHaveLength(4);
    expect(mockSchedule).toHaveBeenCalledTimes(4);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'A date idea with your names on it',
          body: 'Something cozy, playful, or a little new is waiting.',
          data: expect.objectContaining({
            route: 'date-ideas',
            type: 'connection_reminder',
            reminderType: CONNECTION_REMINDER_TYPES.DATE_IDEA,
          }),
        }),
        trigger: expect.objectContaining({ type: 'date', date: expect.any(Date), channelId: 'default' }),
      })
    );
  });

  it('cancels old reminders and skips scheduling when the master switch is off', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('notificationSettings')) {
        return JSON.stringify({
          notificationsEnabled: false,
          connectionReminders: {
            [CONNECTION_REMINDER_TYPES.PROMPT]: { enabled: true },
          },
        });
      }
      if (String(key).includes('connectionReminderIds')) {
        return JSON.stringify(['old-reminder-id']);
      }
      return null;
    });

    const ids = await scheduleConnectionReminders();

    expect(ids).toEqual([]);
    expect(mockCancel).toHaveBeenCalledWith('old-reminder-id');
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
