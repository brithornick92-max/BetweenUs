const mockSchedule = jest.fn().mockResolvedValue('scheduled-id');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
const AsyncStorage = require('@react-native-async-storage/async-storage');

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mockSchedule,
  cancelScheduledNotificationAsync: mockCancel,
  getPermissionsAsync: mockGetPermissions,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const WinBackNudges = require('../../services/WinBackNudges').default;

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockResolvedValue(undefined);
});

describe('WinBackNudges notification preferences', () => {
  it('routes date-oriented win-back nudges to a valid destination', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('notificationSettings')) {
        return JSON.stringify({ notificationsEnabled: true });
      }
      return null;
    });

    await WinBackNudges.scheduleNudges();

    expect(mockSchedule).toHaveBeenCalledTimes(3);
    expect(mockSchedule.mock.calls[2][0].content.data.route).toBe('date-ideas');
  });

  it('does not schedule win-back nudges when app notifications are disabled', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('notificationSettings')) {
        return JSON.stringify({ notificationsEnabled: false });
      }
      if (String(key).includes('winbackNudgeIds')) {
        return JSON.stringify(['old-winback-id']);
      }
      return null;
    });

    await WinBackNudges.scheduleNudges();

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('old-winback-id');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@betweenus:cache:winbackNudgeIds');
  });

  it('does not schedule rhythm reminders when that category is disabled', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('notificationSettings')) {
        return JSON.stringify({ ritualReminders: false });
      }
      if (String(key).includes('streakAlertId')) {
        return 'old-streak-id';
      }
      return null;
    });

    await WinBackNudges.scheduleStreakBreakAlert(4, 'Alex', false);

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('old-streak-id');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@betweenus:cache:streakAlertId');
  });

  it('cancels old rhythm reminders when the user is no longer eligible', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('streakAlertId')) {
        return 'old-streak-id';
      }
      return null;
    });

    await WinBackNudges.scheduleStreakBreakAlert(1, 'Alex', false);

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('old-streak-id');
  });

  it('cancels weekly recaps when memory notifications are disabled', async () => {
    AsyncStorage.getItem.mockImplementation(async (key) => {
      if (String(key).includes('notificationSettings')) {
        return JSON.stringify({ memoryRecaps: false });
      }
      if (String(key).includes('weeklyRecapNotificationId')) {
        return 'old-weekly-recap-id';
      }
      return null;
    });

    await WinBackNudges.scheduleWeeklyRecap({ prompts: 2, partnerName: 'Alex' });

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('old-weekly-recap-id');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@betweenus:cache:weeklyRecapNotificationId');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@betweenus:cache:weeklyRecapScheduledWeek');
  });
});
