require('../helpers/screenTestHarness');

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

const { buildKeepsakeEntriesFromSources } = require('../../screens/OurStoryScreen');

describe('OurStory Keepsake entry building', () => {
  it('includes only prompts, snapshots, dates tried, and positions tried', async () => {
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
          content: 'Should not show',
          created_at: '2026-04-28T12:03:00.000Z',
        },
        {
          id: 'thinking-1',
          type: 'thinking_of_you',
          content: 'Should not show either',
          created_at: '2026-04-28T12:04:00.000Z',
        },
      ],
      dateHistory: [
        {
          id: 'date-1',
          title: 'Coffee walk',
          addedAt: Date.parse('2026-04-28T12:05:00.000Z'),
        },
      ],
      triedPositionHistory: {
        ip001: {
          positionId: 'ip001',
          title: 'Close Hold',
          commonName: 'Side by side',
          mood: 'tender',
          triedAt: '2026-04-28T12:06:00.000Z',
        },
      },
      resolveMedia: async () => null,
    });

    expect(entries.map((entry) => entry.kind).sort()).toEqual([
      'date',
      'position_tried',
      'prompt',
      'snapshot',
    ]);

    expect(entries.some((entry) => entry.id.includes('quiz-1'))).toBe(false);
    expect(entries.some((entry) => entry.sourceId === 'moment-1')).toBe(false);
    expect(entries.some((entry) => entry.sourceId === 'thinking-1')).toBe(false);
  });
});
