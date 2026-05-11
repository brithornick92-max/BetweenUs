import { getProfileCoupleCreatedAt, getProfileCoupleId, resolveActiveCoupleId } from '../../utils/coupleProfile';

describe('coupleProfile', () => {
  it('resolves camelCase and snake_case couple profile fields', () => {
    expect(getProfileCoupleId({ coupleId: 'couple-a' })).toBe('couple-a');
    expect(getProfileCoupleId({ couple_id: 'couple-b' })).toBe('couple-b');
    expect(getProfileCoupleCreatedAt({ coupleCreatedAt: '2026-05-01T00:00:00.000Z' }))
      .toBe('2026-05-01T00:00:00.000Z');
    expect(getProfileCoupleCreatedAt({ couple_created_at: '2026-05-02T00:00:00.000Z' }))
      .toBe('2026-05-02T00:00:00.000Z');
  });

  it('uses the recovered auth profile couple when app state has not hydrated it yet', () => {
    expect(resolveActiveCoupleId({
      appState: { coupleId: null },
      userProfile: { coupleId: 'couple-remote' },
    })).toBe('couple-remote');
  });
});
