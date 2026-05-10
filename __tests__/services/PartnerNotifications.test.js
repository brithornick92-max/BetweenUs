const mockNotifyPartner = jest.fn().mockResolvedValue(undefined);
const mockGetSupabaseOrThrow = jest.fn().mockReturnValue({ supabase: 'mock' });

jest.mock('../../config/supabase', () => ({
  getSupabaseOrThrow: (...args) => mockGetSupabaseOrThrow(...args),
}));

jest.mock('../../services/PushNotificationService', () => ({
  __esModule: true,
  default: {
    notifyPartner: (...args) => mockNotifyPartner(...args),
  },
}));

const PartnerNotifications = require('../../services/PartnerNotifications').default;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PartnerNotifications', () => {
  it('promptAnswered — sends correct title, body, and data', async () => {
    await PartnerNotifications.promptAnswered('Alex', 'h2_042', '2026-05-05');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: expect.stringContaining('Alex'),
        body: expect.stringContaining('reveal'),
        data: expect.objectContaining({
          route: 'prompt',
          type: 'prompt_answered',
          id: 'h2_042',
          dateKey: '2026-05-05',
          date_key: '2026-05-05',
        }),
      })
    );
  });

  it('promptAnswered — falls back to generic name when sender is empty', async () => {
    await PartnerNotifications.promptAnswered('', 'h2_042');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: expect.stringContaining('Your partner') })
    );
  });

  it('vibeSent — sends correct route', async () => {
    await PartnerNotifications.vibeSent('Alex', 'thinking of you');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ route: 'vibe', type: 'vibe_sent', vibeLabel: 'thinking of you' }),
      })
    );
  });

  it('datePlanned — sends correct route', async () => {
    await PartnerNotifications.datePlanned('Alex', 'Movie Night');

    const payload = mockNotifyPartner.mock.calls[0][1];
    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ route: 'calendar', type: 'date_planned' }),
      })
    );
    expect(payload.title).toContain('Alex');
    expect(payload.body).not.toContain('Movie Night');
    expect(payload.data).not.toHaveProperty('title');
  });

  it('calendarEventCreated — sends correct route', async () => {
    await PartnerNotifications.calendarEventCreated('Alex', 'Dinner');

    const payload = mockNotifyPartner.mock.calls[0][1];
    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ route: 'calendar', type: 'calendar_event_created' }),
      })
    );
    expect(payload.title).toContain('Alex');
    expect(payload.body).not.toContain('Dinner');
    expect(payload.data).not.toHaveProperty('title');
  });

  it('quizAnswered — sends correct route', async () => {
    await PartnerNotifications.quizAnswered('Alex');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: expect.stringContaining('Daily Quiz'),
        data: expect.objectContaining({ route: 'quiz', type: 'quiz_answered' }),
      })
    );
  });

  it('memorySaved — names anniversary type without revealing private details', async () => {
    await PartnerNotifications.memorySaved('Alex', 'anniversary');

    const payload = mockNotifyPartner.mock.calls[0][1];
    expect(payload.title).toContain('anniversary');
    expect(payload.body).toContain('archive');
    expect(payload.data).toEqual(expect.objectContaining({ route: 'our-story' }));
  });

  it('streakAtRisk — includes connected day count without guilt copy', async () => {
    await PartnerNotifications.streakAtRisk(14);

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: expect.stringContaining('14'),
        body: expect.stringContaining('small moment'),
        data: expect.objectContaining({ route: 'home', type: 'streak_at_risk', streak: 14 }),
      })
    );
  });

  it('does not throw when push delivery fails', async () => {
    mockNotifyPartner.mockRejectedValueOnce(new Error('network error'));

    await expect(PartnerNotifications.promptAnswered('Alex', 'h2_042')).resolves.not.toThrow();
  });
});
