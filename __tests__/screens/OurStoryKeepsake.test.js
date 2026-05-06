require('../helpers/screenTestHarness');

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

const {
  buildDateGroupedKeepsakeList,
  buildKeepsakeEntriesFromSources,
  filterKeepsakeEntriesByDateWindow,
  getKeepsakeEntriesForTier,
} = require('../../screens/OurStoryScreen');
const { KEEPSAKE_CATEGORY_COLORS } = require('../../config/constants');

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
          includeInKeepsake: true,
        },
        {
          id: 'quiz-1',
          prompt_id: 'quiz:q001',
          answer: 'A quiz answer',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:01:00.000Z',
          is_revealed: false,
          includeInKeepsake: true,
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

    expect(KEEPSAKE_CATEGORY_COLORS).toEqual({
      position: '#B91F2D',
      prompt: '#3E63C9',
      date: '#2D7A59',
      memory: '#7152C7',
    });
    expect(entries.find((entry) => entry.kind === 'prompt').accent).toBe(KEEPSAKE_CATEGORY_COLORS.prompt);
    expect(entries.find((entry) => entry.kind === 'snapshot').accent).toBe(KEEPSAKE_CATEGORY_COLORS.memory);
    expect(entries.find((entry) => entry.kind === 'snapshot').eyebrow).toBe('Memory');
    expect(entries.find((entry) => entry.kind === 'memory').accent).toBe(KEEPSAKE_CATEGORY_COLORS.memory);
    expect(entries.find((entry) => entry.kind === 'date').accent).toBe(KEEPSAKE_CATEGORY_COLORS.date);
    expect(entries.find((entry) => entry.kind === 'date_saved').accent).toBe(KEEPSAKE_CATEGORY_COLORS.date);
    expect(entries.find((entry) => entry.kind === 'position_tried').accent).toBe(KEEPSAKE_CATEGORY_COLORS.position);
    expect(entries.find((entry) => entry.kind === 'position_favorite').accent).toBe(KEEPSAKE_CATEGORY_COLORS.position);
  });

  it('only includes prompts explicitly added to Keepsake and combines couple answers into one entry', async () => {
    const entries = await buildKeepsakeEntriesFromSources({
      currentUserId: 'user-1',
      keepsakeSettingsRaw: {
        prompts: true,
        memories: false,
        dates: false,
        positions: false,
      },
      sharedPrompts: [
        {
          id: 'my-prompt-1',
          user_id: 'user-1',
          prompt_id: 'h1_001',
          answer: 'My answer',
          partnerAnswer: 'Partner answer',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:00:00.000Z',
          is_revealed: true,
          includeInKeepsake: true,
        },
        {
          id: 'partner-prompt-1',
          user_id: 'user-2',
          prompt_id: 'h1_001',
          answer: 'Partner answer',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:01:00.000Z',
          is_revealed: true,
          includeInKeepsake: false,
        },
        {
          id: 'my-prompt-2',
          user_id: 'user-1',
          prompt_id: 'h1_002',
          answer: 'Not selected',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:02:00.000Z',
          is_revealed: false,
          includeInKeepsake: false,
        },
      ],
      personalPrompts: [
        {
          id: 'my-prompt-1',
          user_id: 'user-1',
          prompt_id: 'h1_001',
          answer: 'My answer',
          date_key: '2026-04-28',
          created_at: '2026-04-28T12:00:00.000Z',
          is_revealed: true,
          includeInKeepsake: true,
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(expect.objectContaining({
      kind: 'prompt',
      sourceId: 'my-prompt-1',
      contentId: 'h1_001',
      title: expect.any(String),
    }));
    expect(entries[0].answers).toEqual([
      { name: 'You', text: 'My answer' },
      { name: 'Partner', text: 'Partner answer' },
    ]);
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
            dateId: 'd004',
            title: 'Golden Hour Photos',
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

    expect(entries.some((entry) => entry.sourceId === 'd004')).toBe(true);
    expect(entries.some((entry) => entry.sourceId === 'ip001')).toBe(true);

    const dateEntry = entries.find((entry) => entry.kind === 'date');
    expect(dateEntry.body).toBe('Took a peaceful walk and picked a few favorite photos together.');
    expect(dateEntry.meta).toContain('45 min');
    expect(dateEntry.meta).toContain('Out');

    const positionEntry = entries.find((entry) => entry.kind === 'position_tried');
    expect(positionEntry.eyebrow).toBe('Sex position tried');
    expect(positionEntry.body).toBe('Tried a face-to-face seated sex position that felt grounded, emotionally close, and easy to stay with.');
    expect(positionEntry.body).not.toMatch(/intimacy position/i);
    expect(positionEntry.meta).toBe('TENDER');
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
            dateId: 'd013',
            title: 'Next Year Letters',
          }),
          created_at: '2026-04-28T12:05:00.000Z',
        },
        {
          id: 'position-favorite-memory-1',
          type: 'intimacy_favorite',
          content: JSON.stringify({
            kind: 'intimacy_favorite',
            positionId: 'ip002',
            title: 'The Mirror',
            commonName: 'Lotus',
            mood: 'tender',
          }),
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

    const savedDateEntry = entries.find((entry) => entry.kind === 'date_saved');
    expect(savedDateEntry.sourceId).toBe('d013');
    expect(savedDateEntry.body).toBe('Saved a date to craft heartfelt letters to your future selves by candlelight, sharing hopes and dreams to rediscover in one year.');

    const favoritePositionEntry = entries.find((entry) => entry.kind === 'position_favorite');
    expect(favoritePositionEntry.sourceId).toBe('ip002');
    expect(favoritePositionEntry.body).toBe('Saved a very intimate face-to-face seated sex position built around closeness, breath, and slow mutual rhythm.');
    expect(favoritePositionEntry.body).not.toMatch(/intimacy position/i);
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

  it('keeps partner-created keepsakes hide-only instead of editable or deletable', async () => {
    const entries = await buildKeepsakeEntriesFromSources({
      currentUserId: 'user-1',
      keepsakeSettingsRaw: {
        prompts: false,
        memories: true,
        dates: true,
        positions: true,
      },
      sharedMemories: [
        {
          id: 'partner-memory-1',
          user_id: 'user-2',
          type: 'moment',
          content: 'Partner saved moment',
          created_at: '2026-04-28T12:00:00.000Z',
        },
        {
          id: 'partner-date-memory-1',
          user_id: 'user-2',
          type: 'date_tried',
          content: JSON.stringify({
            kind: 'date_history',
            dateId: 'd004',
            title: 'Golden Hour Photos',
          }),
          created_at: '2026-04-28T12:01:00.000Z',
        },
        {
          id: 'partner-position-memory-1',
          user_id: 'user-2',
          type: 'intimacy_tried',
          content: JSON.stringify({
            kind: 'intimacy_tried',
            positionId: 'ip001',
            title: 'Close Hold',
          }),
          created_at: '2026-04-28T12:02:00.000Z',
        },
      ],
      resolveMedia: async () => null,
    });

    expect(entries).toHaveLength(3);
    for (const entry of entries) {
      expect(entry.isOwn).toBe(false);
      expect(entry.editable).toBe(false);
      expect(entry.deletable).toBe(false);
      expect(entry.hideable).toBe(true);
    }
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

  it('filters free keepsakes to the most recent 30 days', () => {
    const filtered = filterKeepsakeEntriesByDateWindow(
      [
        {
          id: 'recent-entry',
          kind: 'memory',
          sourceId: 'recent-entry',
          sortAt: '2026-05-04T12:00:00.000Z',
        },
        {
          id: 'old-entry',
          kind: 'memory',
          sourceId: 'old-entry',
          sortAt: '2026-03-20T12:00:00.000Z',
        },
      ],
      30,
      new Date('2026-05-05T12:00:00.000Z')
    );

    expect(filtered.map((entry) => entry.id)).toEqual(['recent-entry']);
  });

  it('gives free users a 30-day Keepsake window and premium users lifetime Keepsake', () => {
    const entries = [
      {
        id: 'recent-entry',
        kind: 'memory',
        sourceId: 'recent-entry',
        sortAt: '2026-05-04T12:00:00.000Z',
      },
      {
        id: 'old-entry',
        kind: 'memory',
        sourceId: 'old-entry',
        sortAt: '2024-05-04T12:00:00.000Z',
      },
    ];
    const referenceDate = new Date('2026-05-05T12:00:00.000Z');

    expect(getKeepsakeEntriesForTier(entries, { isPremium: false, referenceDate }).map((entry) => entry.id))
      .toEqual(['recent-entry']);
    expect(getKeepsakeEntriesForTier(entries, { isPremium: true, referenceDate }).map((entry) => entry.id))
      .toEqual(['recent-entry', 'old-entry']);
  });
});
