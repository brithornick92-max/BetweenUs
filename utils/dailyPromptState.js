import { isTodayBetweenUsPrompt } from './contentLoader';
import { getDailyContentDateKey } from './dailyContentDate';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const hasPromptText = (prompt) => (
  !!prompt?.id
  && typeof prompt?.text === 'string'
  && !!prompt.text.trim()
);

function normalizeDateKey(value) {
  const dateKey = typeof value === 'string' ? value.trim() : '';
  return DATE_KEY_RE.test(dateKey) ? dateKey : null;
}

export function resolveVisibleDailyPromptState(
  todayPrompt,
  currentDateKey = getDailyContentDateKey(),
  expectedScope = null
) {
  const promptDateKey = todayPrompt?.dateKey || null;
  const promptScope = todayPrompt?._dailyPromptScope || null;
  const normalizedExpectedScope = typeof expectedScope === 'string' && expectedScope.trim()
    ? expectedScope.trim()
    : null;
  const scopeMatches = !normalizedExpectedScope || promptScope === normalizedExpectedScope;
  const isCurrent = !!todayPrompt && promptDateKey === currentDateKey && scopeMatches;

  return {
    prompt: isCurrent ? todayPrompt : null,
    dateKey: isCurrent ? promptDateKey : currentDateKey,
    promptReady: isCurrent && hasPromptText(todayPrompt),
    isStale: !!todayPrompt && (!isCurrent || !scopeMatches),
  };
}

export function resolvePromptAnswerDateKey(
  prompt,
  currentDateKey = getDailyContentDateKey(),
  explicitDateKey = null
) {
  const routedDateKey = normalizeDateKey(explicitDateKey);
  if (routedDateKey) return routedDateKey;

  const promptDateKey = normalizeDateKey(prompt?.dateKey || prompt?.date_key);
  if (isTodayBetweenUsPrompt(prompt)) {
    return promptDateKey || currentDateKey;
  }

  return promptDateKey || currentDateKey;
}
