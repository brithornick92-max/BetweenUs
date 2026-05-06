import { isTodayBetweenUsPrompt } from './contentLoader';
import { getDailyContentDateKey } from './dailyContentDate';

const hasPromptText = (prompt) => (
  !!prompt?.id
  && typeof prompt?.text === 'string'
  && !!prompt.text.trim()
);

export function resolveVisibleDailyPromptState(
  todayPrompt,
  currentDateKey = getDailyContentDateKey()
) {
  const promptDateKey = todayPrompt?.dateKey || null;
  const isCurrent = !!todayPrompt && promptDateKey === currentDateKey;

  return {
    prompt: isCurrent ? todayPrompt : null,
    dateKey: isCurrent ? promptDateKey : currentDateKey,
    promptReady: isCurrent && hasPromptText(todayPrompt),
    isStale: !!todayPrompt && !isCurrent,
  };
}

export function resolvePromptAnswerDateKey(
  prompt,
  currentDateKey = getDailyContentDateKey()
) {
  if (isTodayBetweenUsPrompt(prompt)) {
    return currentDateKey;
  }

  return prompt?.dateKey || currentDateKey;
}
