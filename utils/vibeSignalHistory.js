export const VIBE_HISTORY_SOURCE_HEARTBEAT = 'heartbeat';
export const VIBE_HISTORY_DAYS = 7;

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

const toTimestampMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export function buildVibeFluxData(myVibes = [], partnerVibes = []) {
  const countByDay = (vibes) => {
    const buckets = [0, 0, 0, 0, 0, 0, 0];

    for (const entry of (Array.isArray(vibes) ? vibes : [])) {
      const timestamp = toTimestampMs(entry?.timestamp ?? entry?.sentAt ?? entry?.sent_at ?? entry?.createdAt);
      if (timestamp === null) continue;

      const dow = new Date(timestamp).getDay();
      if (Number.isInteger(dow) && dow >= 0 && dow <= 6) {
        buckets[dow] += 1;
      }
    }

    return ORDERED_DAYS.map((day) => buckets[day]);
  };

  const mine = countByDay(myVibes);
  const partner = countByDay(partnerVibes);
  const hasAny = mine.some(Boolean) || partner.some(Boolean);

  return hasAny ? { mine, partner } : null;
}
