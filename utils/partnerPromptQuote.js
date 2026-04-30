function parseDateKey(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isAtLeastOneYearOld(date, now) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return date <= oneYearAgo;
}

function sameMonthDay(date, now) {
  return date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function pickRandom(items, random = Math.random) {
  if (!items.length) return null;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

export function choosePartnerPromptQuote(rows = [], {
  now = new Date(),
  relationshipStartDate = null,
  random = Math.random,
} = {}) {
  const todayKey = localDateKey(now);

  const candidates = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const date = parseDateKey(row?.date_key);
      const answer = typeof row?.partnerAnswer === 'string' ? row.partnerAnswer.trim() : '';

      if (!date || !answer || row.date_key === todayKey) return null;
      if (String(row?.prompt_id || '').startsWith('quiz:')) return null;

      return { ...row, partnerAnswer: answer, date };
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  const startDate = parseDateKey(relationshipStartDate) || (relationshipStartDate ? new Date(relationshipStartDate) : null);
  const hasOneYearOfHistory = isAtLeastOneYearOld(startDate, now)
    || candidates.some((row) => isAtLeastOneYearOld(row.date, now));

  const onThisDayCandidates = hasOneYearOfHistory
    ? candidates.filter((row) => sameMonthDay(row.date, now))
    : [];

  const selected = pickRandom(onThisDayCandidates.length ? onThisDayCandidates : candidates, random);
  if (!selected) return null;

  return {
    ...selected,
    answer: selected.partnerAnswer,
    isOnThisDay: onThisDayCandidates.includes(selected),
  };
}

export function canShowPartnerPromptQuote({
  answeredCount = 0,
  firstOpenDate = null,
  now = new Date(),
  minDays = 5,
  minAnswers = 5,
} = {}) {
  const openedAt = parseDateKey(firstOpenDate) || (firstOpenDate ? new Date(firstOpenDate) : null);
  const openedAtMs = openedAt instanceof Date ? openedAt.getTime() : NaN;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (!Number.isFinite(openedAtMs) || !Number.isFinite(nowMs)) return false;

  const daysSinceFirstOpen = Math.floor((nowMs - openedAtMs) / (1000 * 60 * 60 * 24));

  return daysSinceFirstOpen >= minDays && Number(answeredCount || 0) >= minAnswers;
}
