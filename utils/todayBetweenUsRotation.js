import { MINIMUM_QUESTION_REPEAT_DAYS, getNoRepeatRotationItem } from './noRepeatContentRotation';

export const TODAY_BETWEEN_US_HEAT_LEVELS = [1, 2, 3];
export const TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS = MINIMUM_QUESTION_REPEAT_DAYS;

export function getTodayBetweenUsRotationPool(prompts = []) {
  const buckets = new Map(TODAY_BETWEEN_US_HEAT_LEVELS.map((heat) => [heat, []]));

  (Array.isArray(prompts) ? prompts : []).forEach((prompt) => {
    const heat = Number(prompt?.heat || 1);
    if (!buckets.has(heat)) return;
    buckets.get(heat).push(prompt);
  });

  buckets.forEach((items) => {
    items.sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
  });

  const maxBucketSize = Math.max(
    0,
    ...TODAY_BETWEEN_US_HEAT_LEVELS.map((heat) => buckets.get(heat)?.length || 0)
  );
  const ordered = [];

  for (let index = 0; index < maxBucketSize; index += 1) {
    TODAY_BETWEEN_US_HEAT_LEVELS.forEach((heat) => {
      const prompt = buckets.get(heat)?.[index];
      if (prompt) ordered.push(prompt);
    });
  }

  return ordered;
}

export function selectTodayBetweenUsPrompt(promptPool, dateKey, scope = 'default') {
  const rotationPool = getTodayBetweenUsRotationPool(promptPool)
    .filter((prompt) => prompt?.id && typeof prompt.text === 'string' && prompt.text.trim());

  return getNoRepeatRotationItem(rotationPool, dateKey, {
    seed: `${scope || 'default'}:today-between-us`,
    stableCycleSize: TODAY_BETWEEN_US_ROTATION_CYCLE_DAYS,
  });
}
