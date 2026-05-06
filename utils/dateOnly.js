const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isValidDateParts(year, month, day) {
  const candidate = new Date(year, month - 1, day);
  return (
    candidate.getFullYear() === year
    && candidate.getMonth() === month - 1
    && candidate.getDate() === day
  );
}

export function formatLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function normalizeDateOnlyKey(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') {
    const match = value.trim().match(DATE_ONLY_PATTERN);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      return isValidDateParts(year, month, day)
        ? `${year}-${pad2(month)}-${pad2(day)}`
        : null;
    }
  }

  return formatLocalDateKey(value);
}

export function dateOnlyToLocalDate(value, { hour = 12, minute = 0 } = {}) {
  const key = normalizeDateOnlyKey(value);
  if (!key) return null;

  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function isFutureLocalDate(value, now = new Date()) {
  const key = normalizeDateOnlyKey(value);
  const todayKey = formatLocalDateKey(now);
  return !!(key && todayKey && key > todayKey);
}

export default {
  formatLocalDateKey,
  normalizeDateOnlyKey,
  dateOnlyToLocalDate,
  isFutureLocalDate,
};
