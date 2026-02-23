/**
 * notifications.test.js — Tests for notification utility
 */

// Mock expo-notifications
const mockSchedule = jest.fn().mockResolvedValue('notif-id-123');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetPermissions = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissions = jest.fn().mockResolvedValue({ status: 'granted' });

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: mockSchedule,
  cancelScheduledNotificationAsync: mockCancel,
  getPermissionsAsync: mockGetPermissions,
  requestPermissionsAsync: mockRequestPermissions,
}));

const {
  ensureNotificationPermissions,
  scheduleEventNotification,
  cancelNotification,
} = require('../../utils/notifications');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ensureNotificationPermissions', () => {
  it('returns ok:true if already granted', async () => {
    const result = await ensureNotificationPermissions();
    expect(result.ok).toBe(true);
  });

  it('requests permissions if not yet granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValueOnce({ status: 'granted' });
    const result = await ensureNotificationPermissions();
    expect(result.ok).toBe(true);
    expect(mockRequestPermissions).toHaveBeenCalled();
  });
});

describe('scheduleEventNotification', () => {
  it('schedules a future notification', async () => {
    const futureTime = Date.now() + 60000; // 1 min in the future
    const id = await scheduleEventNotification({
      title: 'Test',
      body: 'Test body',
      when: futureTime,
    });
    expect(id).toBe('notif-id-123');
    expect(mockSchedule).toHaveBeenCalledWith({
      content: { title: 'Test', body: 'Test body', data: {} },
      trigger: { date: expect.any(Date) },
    });
  });

  it('returns null for past times (safety guard)', async () => {
    const pastTime = Date.now() - 60000; // 1 min in the past
    const id = await scheduleEventNotification({
      title: 'Test',
      body: 'Test body',
      when: pastTime,
    });
    expect(id).toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe('cancelNotification', () => {
  it('cancels a notification by id', async () => {
    await cancelNotification('notif-id-123');
    expect(mockCancel).toHaveBeenCalledWith('notif-id-123');
  });

  it('does nothing with null id', async () => {
    await cancelNotification(null);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
