export const MINIMUM_QUESTION_REPEAT_DAYS = 183;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DAILY_CONTENT_ROTATION_ANCHOR_UTC = Date.UTC(2026, 0, 1);

export function stableStringHash(value) {
  const input = String(value ?? '');
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getDateKeyDayOffset(dateKey, anchorUtc = DAILY_CONTENT_ROTATION_ANCHOR_UTC) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''));

  if (match) {
    const [, year, month, day] = match;
    const dayUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));

    if (!Number.isNaN(dayUtc)) {
      return Math.floor((dayUtc - anchorUtc) / MS_PER_DAY);
    }
  }

  return stableStringHash(dateKey);
}

export function getNoRepeatRotationIndex(
  dateKey,
  totalItems,
  {
    seed = '',
    anchorUtc = DAILY_CONTENT_ROTATION_ANCHOR_UTC,
    stableCycleSize = null,
  } = {}
) {
  const total = Number(totalItems);
  if (!Number.isFinite(total) || total <= 0) return -1;
  const stableTotal = Number(stableCycleSize);
  const rotationTotal = Number.isFinite(stableTotal) && stableTotal > 0
    ? Math.min(total, stableTotal)
    : total;

  const dayOffset = getDateKeyDayOffset(dateKey, anchorUtc);
  const seedOffset = seed ? stableStringHash(seed) % rotationTotal : 0;
  const index = (dayOffset + seedOffset) % rotationTotal;

  return index < 0 ? index + rotationTotal : index;
}

const defaultIdentity = (item) =>
  item?.id ?? item?.promptId ?? item?.questionId ?? item?.dateId ?? item?.title ?? item?.text ?? null;

export function getNoRepeatRotationItem(items, dateKey, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;

  const index = getNoRepeatRotationIndex(dateKey, list.length, options);
  return index >= 0 ? list[index] : null;
}

export function getNoRepeatWindowStatus(
  items,
  {
    minRepeatDays = MINIMUM_QUESTION_REPEAT_DAYS,
    getIdentity = defaultIdentity,
  } = {}
) {
  const uniqueIds = new Set(
    (Array.isArray(items) ? items : [])
      .map(getIdentity)
      .filter((id) => id != null)
      .map(String)
  );

  return {
    canGuarantee: uniqueIds.size >= minRepeatDays,
    minRepeatDays,
    uniqueCount: uniqueIds.size,
  };
}
