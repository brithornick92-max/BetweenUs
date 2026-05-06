import { getDailyContentDateKey } from './dailyContentDate';
import { dateOnlyToLocalDate } from './dateOnly';
import { storage, STORAGE_KEYS } from './storage';

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

function getQuoteIdentity(row) {
  const promptId = String(row?.prompt_id || '');
  const dateKey = String(row?.date_key || '');
  return promptId && dateKey ? `${dateKey}:${promptId}` : null;
}

function getQuoteCandidatePools(candidates, { now, relationshipStartDate }) {
  const startDate = parseDateKey(relationshipStartDate)
    || dateOnlyToLocalDate(relationshipStartDate)
    || (relationshipStartDate ? new Date(relationshipStartDate) : null);
  const hasOneYearOfHistory = isAtLeastOneYearOld(startDate, now)
    || candidates.some((row) => isAtLeastOneYearOld(row.date, now));

  const onThisDayCandidates = hasOneYearOfHistory
    ? candidates.filter((row) => sameMonthDay(row.date, now))
    : [];

  return {
    pool: onThisDayCandidates.length ? onThisDayCandidates : candidates,
    onThisDayCandidates,
  };
}

function formatPartnerPromptQuote(selected, onThisDayCandidates) {
  if (!selected) return null;

  return {
    ...selected,
    answer: selected.partnerAnswer,
    isOnThisDay: onThisDayCandidates.includes(selected),
  };
}

function normalizePartnerQuoteRows(rows = [], now = new Date()) {
  const todayKey = getDailyContentDateKey(now);

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const date = parseDateKey(row?.date_key);
      const answer = typeof row?.partnerAnswer === 'string' ? row.partnerAnswer.trim() : '';

      if (!date || !answer || row.date_key === todayKey) return null;
      if (String(row?.prompt_id || '').startsWith('quiz:')) return null;

      return { ...row, partnerAnswer: answer, date };
    })
    .filter(Boolean);
}

export function getPartnerPromptQuoteCandidateCount(rows = [], { now = new Date() } = {}) {
  return normalizePartnerQuoteRows(rows, now).length;
}

export function choosePartnerPromptQuote(rows = [], {
  now = new Date(),
  relationshipStartDate = null,
  random = Math.random,
} = {}) {
  const candidates = normalizePartnerQuoteRows(rows, now);

  if (!candidates.length) return null;

  const { pool, onThisDayCandidates } = getQuoteCandidatePools(candidates, {
    now,
    relationshipStartDate,
  });
  const selected = pickRandom(pool, random);

  return formatPartnerPromptQuote(selected, onThisDayCandidates);
}

export async function chooseDailyPartnerPromptQuote(rows = [], {
  now = new Date(),
  relationshipStartDate = null,
  random = Math.random,
} = {}) {
  const candidates = normalizePartnerQuoteRows(rows, now);

  if (!candidates.length) return null;

  const dailyKey = getDailyContentDateKey(now);
  const { pool, onThisDayCandidates } = getQuoteCandidatePools(candidates, {
    now,
    relationshipStartDate,
  });
  const cache = await storage.get(STORAGE_KEYS.PARTNER_PROMPT_DAILY_QUOTE, {});
  const cachedIdentity = cache?.[dailyKey]?.identity || null;
  const cachedCandidate = cachedIdentity
    ? candidates.find((row) => getQuoteIdentity(row) === cachedIdentity)
    : null;

  if (cachedCandidate) {
    return formatPartnerPromptQuote(cachedCandidate, onThisDayCandidates);
  }

  const selected = pickRandom(pool, random);
  const identity = getQuoteIdentity(selected);

  if (selected && identity) {
    await storage.set(STORAGE_KEYS.PARTNER_PROMPT_DAILY_QUOTE, {
      [dailyKey]: {
        identity,
        dateKey: selected.date_key,
        promptId: selected.prompt_id,
        selectedAt: new Date().toISOString(),
      },
    });
  }

  return formatPartnerPromptQuote(selected, onThisDayCandidates);
}

export function canShowPartnerPromptQuote({
  answeredCount = 0,
  firstOpenDate = null,
  now = new Date(),
  minDays = 0,
  minAnswers = 5,
} = {}) {
  if (Number(answeredCount || 0) < minAnswers) return false;
  if (!minDays) return true;

  const openedAt = parseDateKey(firstOpenDate) || (firstOpenDate ? new Date(firstOpenDate) : null);
  const openedAtMs = openedAt instanceof Date ? openedAt.getTime() : NaN;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (!Number.isFinite(openedAtMs) || !Number.isFinite(nowMs)) return false;

  const daysSinceFirstOpen = Math.floor((nowMs - openedAtMs) / (1000 * 60 * 60 * 24));

  return daysSinceFirstOpen >= minDays;
}
