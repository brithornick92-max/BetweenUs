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
    await PartnerNotifications.promptAnswered('Alex', 'h2_042');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: expect.stringContaining('Alex'),
        body: expect.stringContaining('Answer'),
        data: expect.objectContaining({ route: 'prompt', type: 'prompt_answered', id: 'h2_042' }),
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

  it('loveNoteSent — includes note id in data', async () => {
    await PartnerNotifications.loveNoteSent('Alex', 'note-99');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ route: 'love-note', type: 'love_note_sent', id: 'note-99' }),
      })
    );
  });

  it('loveNoteSent — omits id when none is provided', async () => {
    await PartnerNotifications.loveNoteSent('Alex', null);

    const payload = mockNotifyPartner.mock.calls[0][1];
    expect(payload.data).not.toHaveProperty('id');
  });

  it('vibeSent — sends correct route', async () => {
    await PartnerNotifications.vibeSent('Alex', 'thinking of you');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ route: 'vibe', type: 'vibe_sent' }),
      })
    );
  });

  it('datePlanned — sends correct route', async () => {
    await PartnerNotifications.datePlanned('Alex', 'Movie Night');

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ route: 'calendar', type: 'date_planned' }),
      })
    );
  });

  it('memorySaved — uses anniversary emoji for anniversary type', async () => {
    await PartnerNotifications.memorySaved('Alex', 'anniversary');

    const payload = mockNotifyPartner.mock.calls[0][1];
    expect(payload.title).toContain('🎉');
  });

  it('streakAtRisk — includes streak count in title', async () => {
    await PartnerNotifications.streakAtRisk(14);

    expect(mockNotifyPartner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: expect.stringContaining('14'),
        data: expect.objectContaining({ route: 'home', type: 'streak_at_risk', streak: 14 }),
      })
    );
  });

  it('does not throw when push delivery fails', async () => {
    mockNotifyPartner.mockRejectedValueOnce(new Error('network error'));

    await expect(PartnerNotifications.promptAnswered('Alex', 'h2_042')).resolves.not.toThrow();
  });
});
