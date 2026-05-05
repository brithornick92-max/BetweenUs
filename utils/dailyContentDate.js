export const DAILY_CONTENT_ROLLOVER_HOUR = 4;

function coerceDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeRolloverHour(value) {
  return Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : DAILY_CONTENT_ROLLOVER_HOUR;
}

function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyContentDateKey(
  date = new Date(),
  rolloverHour = DAILY_CONTENT_ROLLOVER_HOUR
) {
  const adjusted = coerceDate(date);
  adjusted.setHours(adjusted.getHours() - normalizeRolloverHour(rolloverHour));
  return formatLocalDateKey(adjusted);
}

export function getNextDailyContentRollover(
  date = new Date(),
  rolloverHour = DAILY_CONTENT_ROLLOVER_HOUR
) {
  const now = coerceDate(date);
  const hour = normalizeRolloverHour(rolloverHour);
  const next = new Date(now.getTime());

  next.setHours(hour, 0, 0, 0);
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function getMsUntilNextDailyContentRollover(
  date = new Date(),
  rolloverHour = DAILY_CONTENT_ROLLOVER_HOUR
) {
  const now = coerceDate(date);
  return Math.max(0, getNextDailyContentRollover(now, rolloverHour).getTime() - now.getTime());
}
