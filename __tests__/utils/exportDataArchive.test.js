const {
  buildExportPayload,
  gatherExportData,
  isShareCancellation,
  sanitizeExportRows,
} = require('../../utils/exportDataArchive');

const makeDataLayer = (overrides = {}) => ({
  getJournalEntries: jest.fn().mockResolvedValue([{ id: 'journal-1', body: 'Entry', sync_status: 'synced' }]),
  getPromptAnswers: jest.fn().mockResolvedValue([{ id: 'prompt-1', answer: 'Answer' }]),
  getMemories: jest.fn().mockResolvedValue([{ id: 'memory-1', content: 'Memory', locked: true }]),
  getRituals: jest.fn().mockResolvedValue([]),
  getCheckIns: jest.fn().mockResolvedValue([{ id: 'check-1', mood: 'good' }]),
  getVibes: jest.fn().mockResolvedValue([{ id: 'vibe-1', vibe: 'close' }]),
  getLoveNotes: jest.fn().mockResolvedValue([{ id: 'note-1', body: 'Love note' }]),
  getCalendarEvents: jest.fn().mockResolvedValue([{ id: 'event-1', title: 'Date night' }]),
  getDatePlans: jest.fn().mockResolvedValue([{ id: 'date-1', title: 'Dinner' }]),
  getDateShortlist: jest.fn().mockResolvedValue([{ date_id: 'date-idea-1', created_at: '2026-05-01T00:00:00.000Z' }]),
  ...overrides,
});

describe('exportDataArchive', () => {
  it('gathers every export section and removes internal fields', async () => {
    const dataLayer = makeDataLayer();

    const data = await gatherExportData(dataLayer, { userId: 'user-1' });

    expect(dataLayer.getJournalEntries).toHaveBeenCalledWith({ limit: 10000 });
    expect(dataLayer.getLoveNotes).toHaveBeenCalledWith({ limit: 10000 });
    expect(dataLayer.getDatePlans).toHaveBeenCalledWith({ limit: 10000 });
    expect(dataLayer.getDateShortlist).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(data.journalEntries).toEqual([{ id: 'journal-1', body: 'Entry' }]);
    expect(data.memories).toEqual([{ id: 'memory-1', content: 'Memory' }]);
    expect(data.loveNotes).toEqual([{ id: 'note-1', body: 'Love note' }]);
    expect(data.dateShortlist).toEqual([{ date_id: 'date-idea-1', created_at: '2026-05-01T00:00:00.000Z' }]);
  });

  it('continues with an empty section when one data source fails', async () => {
    const onPartialError = jest.fn();
    const dataLayer = makeDataLayer({
      getVibes: jest.fn().mockRejectedValue(new Error('offline')),
    });

    const data = await gatherExportData(dataLayer, { onPartialError });

    expect(data.vibes).toEqual([]);
    expect(data.journalEntries).toHaveLength(1);
    expect(onPartialError).toHaveBeenCalledWith(['Vibes']);
  });

  it('builds totals and optional account metadata', () => {
    const payload = buildExportPayload({
      exportDate: new Date('2026-05-05T12:00:00.000Z'),
      appVersion: '2.0.0',
      includeAccountDetails: true,
      user: { uid: 'user-1', email: 'me@example.com' },
      userProfile: {
        display_name: 'Brittany',
        created_at: '2026-01-01T00:00:00.000Z',
        preferences: {
          relationshipStartDate: '2025-01-01',
          partnerNames: { myName: 'B', partnerName: 'A' },
          heatLevelPreference: 4,
        },
      },
      allData: {
        promptAnswers: [{ id: 'prompt-1' }],
        loveNotes: [{ id: 'note-1' }, { id: 'note-2' }],
      },
    });

    expect(payload.exportDate).toBe('2026-05-05T12:00:00.000Z');
    expect(payload.appVersion).toBe('2.0.0');
    expect(payload.user).toMatchObject({
      id: 'user-1',
      email: 'me@example.com',
      displayName: 'Brittany',
      relationshipStartDate: '2025-01-01',
      heatLevelPreference: 4,
    });
    expect(payload.totals.promptAnswers).toBe(1);
    expect(payload.totals.loveNotes).toBe(2);
    expect(payload.totals.memories).toBe(0);
  });

  it('omits account metadata when the user leaves it off', () => {
    const payload = buildExportPayload({
      includeAccountDetails: false,
      user: { uid: 'user-1', email: 'me@example.com' },
      allData: { journalEntries: [] },
    });

    expect(payload.user).toBeNull();
  });

  it('recognizes common share-sheet cancellation errors', () => {
    expect(isShareCancellation(new Error('User cancelled'))).toBe(true);
    expect(isShareCancellation(new Error('Share sheet dismissed'))).toBe(true);
    expect(isShareCancellation(new Error('Operation canceled'))).toBe(true);
    expect(isShareCancellation(new Error('Disk full'))).toBe(false);
  });

  it('sanitizes non-array rows safely', () => {
    expect(sanitizeExportRows(null)).toEqual([]);
    expect(sanitizeExportRows([{ id: '1', sync_source: 'local', locked: true }])).toEqual([{ id: '1' }]);
  });
});
