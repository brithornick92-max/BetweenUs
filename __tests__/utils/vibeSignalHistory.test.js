import { buildVibeFluxData } from '../../utils/vibeSignalHistory';

describe('vibe signal history helpers', () => {
  it('builds Mon-Sun flux buckets from sent and received heartbeat entries', () => {
    const result = buildVibeFluxData(
      [
        { timestamp: '2026-05-04T12:00:00.000Z' }, // Monday
        { timestamp: '2026-05-04T18:00:00.000Z' },
      ],
      [
        { timestamp: '2026-05-03T12:00:00.000Z' }, // Sunday
      ]
    );

    expect(result).toEqual({
      mine: [2, 0, 0, 0, 0, 0, 0],
      partner: [0, 0, 0, 0, 0, 0, 1],
    });
  });

  it('ignores invalid timestamps and returns null when nothing countable remains', () => {
    expect(buildVibeFluxData([{ timestamp: 'not-a-date' }], [])).toBeNull();
  });
});
