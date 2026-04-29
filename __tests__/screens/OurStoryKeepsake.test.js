require('../helpers/screenTestHarness');

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

const {
  buildDateGroupedKeepsakeList,
  buildKeepsakeEntriesFromSources,
} = require('../../screens/OurStoryScreen');

describe('OurStory Keepsake entry building', () => {
  it('includes prompts, snapshots, standalone memories, dates tried, and positions tried', async () => {
    const entries = await buildKeepsakeEntriesFromSources({
      keepsakeSettingsRaw: {
        prompts: true,
        memories: true,
        dates: true,
        positions: true,
      },
      personalPrompts: [
        {
          id: 'prompt-1',
          prompt_id: 'h1_001',
          answer: 'A real prompt answer',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:00:00.000Z',
          is_revealed: false,
        },
        {
          id: 'quiz-1',
          prompt_id: 'quiz:q001',
          answer: 'A quiz answer',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:01:00.000Z',
          is_revealed: false,
        },
      ],
      personalMemories: [
        {
          id: 'snapshot-1',
          type: 'snapshot',
          content: 'A snapshot note',
          created_at: '2026-04-28T12:02:00.000Z',
          snapshot_id: 'snap-group-1',
          snapshot_index: 0,
          snapshot_count: 1,
          snapshot_created_at: '2026-04-28T12:02:00.000Z',
        },
        {
          id: 'moment-1',
          type: 'moment',
          content: 'A saved moment',
          created_at: '2026-04-28T12:03:00.000Z',
        },
        {
          id: 'thinking-1',
          type: 'thinking_of_you',
          content: 'Thinking of you',
          created_at: '2026-04-28T12:04:00.000Z',
        },
        {
          id: 'date-memory-1',
          type: 'date_tried',
          content: '{"kind":"date_history","dateId":"date-1","title":"Coffee walk"}',
          created_at: '2026-04-28T12:04:30.000Z',
        },
        {
          id: 'saved-date-memory-1',
          type: 'date_saved',
          content: '{"kind":"date_saved","dateId":"date-2","title":"Gallery walk"}',
          created_at: '2026-04-28T12:04:40.000Z',
        },
        {
          id: 'position-memory-1',
          type: 'intimacy_tried',
          content: '{"kind":"intimacy_tried","positionId":"ip001","title":"Close Hold"}',
          created_at: '2026-04-28T12:04:45.000Z',
        },
        {
          id: 'favorite-position-memory-1',
          type: 'intimacy_favorite',
          content: 'Shared intimacy favorite: Face to face',
          mood: 'tender',
          created_at: '2026-04-28T12:04:50.000Z',
        },
      ],
      resolveMedia: async () => null,
    });

    expect(entries.map((entry) => entry.kind).sort()).toEqual([
      'date',
      'date_saved',
      'memory',
      'memory',
      'position_favorite',
      'position_tried',
      'prompt',
      'snapshot',
    ]);

    expect(entries.some((entry) => entry.id.includes('quiz-1'))).toBe(false);
    expect(entries.some((entry) => entry.sourceId === 'moment-1')).toBe(true);
    expect(entries.some((entry) => entry.sourceId === 'thinking-1')).toBe(true);
    expect(entries.some((entry) => entry.sourceId === 'date-memory-1')).toBe(false);
    expect(entries.some((entry) => entry.sourceId === 'saved-date-memory-1')).toBe(false);
    expect(entries.some((entry) => entry.sourceId === 'date-2')).toBe(true);
    expect(entries.some((entry) => entry.sourceId === 'position-memory-1')).toBe(false);
    expect(entries.some((entry) => entry.sourceId === 'favorite-position-memory-1')).toBe(true);
  });

  it('builds dates tried and positions tried directly from memory rows', async () => {
    const entries = await buildKeepsakeEntriesFromSources({
      keepsakeSettingsRaw: {
        prompts: false,
        memories: true,
        dates: true,
        positions: true,
      },
      personalMemories: [
        {
          id: 'date-memory-1',
          type: 'date_tried',
          content: JSON.stringify({
            kind: 'date_history',
            dateId: 'date-1',
            title: 'Coffee walk',
            minutes: 45,
            location: 'out',
          }),
          mood: 'cozy',
          created_at: '2026-04-28T12:05:00.000Z',
        },
        {
          id: 'position-memory-1',
          type: 'intimacy_tried',
          content: JSON.stringify({
            kind: 'intimacy_tried',
            positionId: 'ip001',
            title: 'Close Hold',
            commonName: 'Side by side',
            mood: 'tender',
          }),
          mood: 'tender',
          created_at: '2026-04-28T12:06:00.000Z',
        },
      ],
      resolveMedia: async () => null,
    });

    expect(entries.map((entry) => entry.kind).sort()).toEqual([
      'date',
      'position_tried',
    ]);

    expect(entries.some((entry) => entry.sourceId === 'date-1')).toBe(true);
    expect(entries.some((entry) => entry.sourceId === 'ip001')).toBe(true);
  });

  it('includes saved dates and favorite positions from memory rows', async () => {
    const entries = await buildKeepsakeEntriesFromSources({
      keepsakeSettingsRaw: {
        prompts: false,
        memories: true,
        dates: true,
        positions: true,
      },
      personalMemories: [
        {
          id: 'date-saved-memory-1',
          type: 'date_saved',
          content: JSON.stringify({
            kind: 'date_saved',
            dateId: 'date-1',
            title: 'Coffee walk',
          }),
          created_at: '2026-04-28T12:05:00.000Z',
        },
        {
          id: 'position-favorite-memory-1',
          type: 'intimacy_favorite',
          content: 'Shared intimacy favorite: Side by side: Close Hold',
          mood: 'tender',
          created_at: '2026-04-28T12:06:00.000Z',
        },
      ],
      resolveMedia: async () => null,
    });

    expect(entries.map((entry) => entry.kind).sort()).toEqual([
      'date_saved',
      'position_favorite',
    ]);

    expect(entries.some((entry) => entry.sourceId === 'date-1')).toBe(true);
    expect(entries.some((entry) => entry.sourceId === 'position-favorite-memory-1')).toBe(true);
  });

  it('includes keepsakes created by both partners from shared memory rows', async () => {
    const entries = await buildKeepsakeEntriesFromSources({
      keepsakeSettingsRaw: {
        prompts: false,
        memories: true,
        dates: true,
        positions: true,
      },
      sharedMemories: [
        {
          id: 'my-memory-1',
          user_id: 'user-1',
          type: 'moment',
          content: 'My saved moment',
          created_at: '2026-04-28T12:00:00.000Z',
        },
        {
          id: 'partner-memory-1',
          user_id: 'user-2',
          type: 'moment',
          content: 'Partner saved moment',
          created_at: '2026-04-28T13:00:00.000Z',
        },
      ],
      personalMemories: [
        {
          id: 'my-memory-1',
          user_id: 'user-1',
          type: 'moment',
          content: 'My saved moment duplicate',
          created_at: '2026-04-28T12:00:00.000Z',
        },
      ],
      resolveMedia: async () => null,
    });

    expect(entries.map((entry) => entry.sourceId)).toEqual([
      'partner-memory-1',
      'my-memory-1',
    ]);
  });

  it('groups keepsakes by date with newest date first and no category priority', () => {
    const rows = buildDateGroupedKeepsakeList([
      {
        id: 'date:date-1',
        kind: 'date',
        sourceId: 'date-1',
        sortAt: '2026-04-29T08:00:00.000Z',
      },
      {
        id: 'snapshot:snap-1',
        kind: 'snapshot',
        sourceId: 'snap-1',
        sortAt: '2026-04-28T12:00:00.000Z',
      },
      {
        id: 'memory:moment-1',
        kind: 'memory',
        sourceId: 'moment-1',
        sortAt: '2026-04-28T10:00:00.000Z',
      },
    ]);

    expect(rows.map((row) => row.kind)).toEqual([
      'date_header',
      'date',
      'date_header',
      'snapshot',
      'memory',
    ]);
    expect(rows[1].sourceId).toBe('date-1');
    expect(rows[3].sourceId).toBe('snap-1');
  });
});
