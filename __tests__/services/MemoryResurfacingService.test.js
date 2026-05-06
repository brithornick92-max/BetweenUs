const mockSchedule = jest.fn().mockResolvedValue('memory-reminder-id');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
const AsyncStorage = require('@react-native-async-storage/async-storage');

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mockSchedule,
  cancelScheduledNotificationAsync: mockCancel,
  getPermissionsAsync: mockGetPermissions,
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const MemoryResurfacingService = require('../../services/MemoryResurfacingService').default;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 4, 6, 7, 30));
  jest.clearAllMocks();
  AsyncStorage.getItem.mockImplementation(async (key) => {
    if (String(key).includes('notificationSettings')) {
      return JSON.stringify({ notificationsEnabled: true, memoryRecaps: true });
    }
    return null;
  });
  AsyncStorage.setItem.mockResolvedValue(undefined);
  AsyncStorage.removeItem.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('MemoryResurfacingService', () => {
  it('schedules on-this-day notifications on the matching local day', async () => {
    const DataLayer = {
      getSharedMemories: jest.fn().mockResolvedValue([
        { id: 'memory-1', created_at: '2024-05-06', content: 'A good day.' },
      ]),
    };

    await MemoryResurfacingService.schedule(DataLayer);

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const triggerDate = mockSchedule.mock.calls[0][0].trigger.date;
    expect(triggerDate.getFullYear()).toBe(2026);
    expect(triggerDate.getMonth()).toBe(4);
    expect(triggerDate.getDate()).toBe(6);
    expect(triggerDate.getHours()).toBe(8);
  });

  it('keeps timestamped memory rows on their local saved day', async () => {
    const DataLayer = {
      getSharedMemories: jest.fn().mockResolvedValue([
        {
          id: 'memory-2',
          created_at: new Date(2024, 4, 6, 21, 30).toISOString(),
          content: 'A late local memory.',
        },
      ]),
    };

    await MemoryResurfacingService.schedule(DataLayer);

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0].content.data.memoryId).toBe('memory-2');
  });
});
