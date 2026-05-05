export const PROMPT_COMPLETION_HIDE_DAYS = 36500;

const DAY_MS = 24 * 60 * 60 * 1000;

const ensureArray = (value) => (Array.isArray(value) ? value : []);

function getPromptAnswerTime(row) {
  const raw = row?.created_at || row?.createdAt || row?.date_key || row?.dateKey || row?.timestamp;
  if (!raw) return 0;

  if (typeof raw === 'number') return raw;

  const value = typeof raw === 'string' && raw.length === 10
    ? new Date(`${raw}T00:00:00`).getTime()
    : new Date(raw).getTime();

  return Number.isNaN(value) ? 0 : value;
}

export function getRecentlyCompletedPromptIds(answers = [], now = Date.now()) {
  const cutoff = now - (PROMPT_COMPLETION_HIDE_DAYS * DAY_MS);

  return new Set(
    ensureArray(answers)
      .filter((row) => row?.answer)
      .filter((row) => !String(row?.prompt_id || row?.promptId || '').startsWith('quiz:'))
      .filter((row) => getPromptAnswerTime(row) >= cutoff)
      .map((row) => row?.prompt_id || row?.promptId)
      .filter(Boolean)
  );
}
