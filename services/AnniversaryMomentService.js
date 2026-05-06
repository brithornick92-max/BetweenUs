import { storage } from '../utils/storage';
import {
  dateOnlyToLocalDate,
  formatLocalDateKey,
  normalizeDateOnlyKey,
} from '../utils/dateOnly';

const POPUP_SEEN_KEY_PREFIX = '@betweenus:anniversaryPopupSeen';
const GENERATED_EVENT_PREFIX = 'generated_anniversary';

export function normalizeAnniversaryDate(value) {
  if (!value) return null;

  const dateOnly = normalizeDateOnlyKey(value);
  if (dateOnly) return dateOnlyToLocalDate(dateOnly);

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function getAnniversaryYearsTogether(startDateValue, todayValue = new Date()) {
  const startDate = normalizeAnniversaryDate(startDateValue);
  const today = normalizeAnniversaryDate(todayValue);
  if (!startDate || !today) return 0;

  let years = today.getFullYear() - startDate.getFullYear();
  const hasReachedThisYearsDate =
    today.getMonth() > startDate.getMonth()
    || (today.getMonth() === startDate.getMonth() && today.getDate() >= startDate.getDate());

  if (!hasReachedThisYearsDate) years -= 1;
  return Math.max(0, years);
}

export function isAnniversaryDay(startDateValue, todayValue = new Date()) {
  const startDate = normalizeAnniversaryDate(startDateValue);
  const today = normalizeAnniversaryDate(todayValue);
  if (!startDate || !today) return false;
  if (today.getFullYear() === startDate.getFullYear()) return false;

  return startDate.getMonth() === today.getMonth() && startDate.getDate() === today.getDate();
}

export function buildAnniversaryCalendarEvent(startDateValue, targetDateValue = new Date()) {
  const startDate = normalizeAnniversaryDate(startDateValue);
  const targetDate = normalizeAnniversaryDate(targetDateValue);
  if (!startDate || !targetDate) return null;

  const eventDate = new Date(
    targetDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    9,
    0,
    0,
    0
  );
  const yearsTogether = getAnniversaryYearsTogether(startDate, eventDate);
  const yearLabel = yearsTogether > 0
    ? `${yearsTogether}${getOrdinalSuffix(yearsTogether)} anniversary`
    : 'Anniversary';

  return {
    id: `${GENERATED_EVENT_PREFIX}_${targetDate.getFullYear()}`,
    title: `Your ${yearLabel}`,
    notes: 'Automatically added from your shared anniversary.',
    eventType: 'anniversary',
    isDateNight: false,
    isGeneratedAnniversary: true,
    whenTs: eventDate.getTime(),
  };
}

export function getEventsForDateWithAnniversary(events = [], dateValue, relationshipStartDate) {
  const date = normalizeAnniversaryDate(dateValue);
  if (!date) return events || [];

  const displayDate = toDisplayDateKey(date);
  const matchingEvents = (events || []).filter((event) => (
    toDisplayDateKey(new Date(event?.whenTs)) === displayDate
  ));

  const anniversaryEvent = buildAnniversaryCalendarEvent(relationshipStartDate, date);
  if (
    anniversaryEvent
    && toDisplayDateKey(new Date(anniversaryEvent.whenTs)) === displayDate
    && !matchingEvents.some((event) => event?.eventType === 'anniversary' || event?.isGeneratedAnniversary)
  ) {
    return [...matchingEvents, anniversaryEvent].sort((a, b) => (a.whenTs || 0) - (b.whenTs || 0));
  }

  return matchingEvents;
}

export async function shouldShowAnniversaryPopup(startDateValue, {
  today = new Date(),
  storageApi = storage,
} = {}) {
  if (!isAnniversaryDay(startDateValue, today)) return null;

  const yearsTogether = getAnniversaryYearsTogether(startDateValue, today);
  if (yearsTogether <= 0) return null;

  const key = getPopupSeenKey(today);
  const seen = await storageApi.get(key, false);
  if (seen) return null;

  return {
    key,
    yearsTogether,
    title: 'Happy anniversary',
    message: yearsTogether === 1
      ? 'One year of choosing each other.'
      : `${yearsTogether} years of choosing each other.`,
    icon: 'sparkles-outline',
  };
}

export async function markAnniversaryPopupSeen(key, {
  storageApi = storage,
} = {}) {
  if (!key) return false;
  await storageApi.set(key, true);
  return true;
}

function getPopupSeenKey(dateValue) {
  const date = normalizeAnniversaryDate(dateValue) || new Date();
  return `${POPUP_SEEN_KEY_PREFIX}:${date.getFullYear()}`;
}

function getOrdinalSuffix(value) {
  const number = Math.abs(Number(value) || 0);
  const lastTwo = number % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return 'th';
  switch (number % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function toDisplayDateKey(value) {
  const date = normalizeAnniversaryDate(value);
  if (!date) return '';
  return formatLocalDateKey(date) || '';
}

export default {
  normalizeAnniversaryDate,
  getAnniversaryYearsTogether,
  isAnniversaryDay,
  buildAnniversaryCalendarEvent,
  getEventsForDateWithAnniversary,
  shouldShowAnniversaryPopup,
  markAnniversaryPopupSeen,
};
