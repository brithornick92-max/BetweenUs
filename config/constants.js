// config/constants.js — App-wide constants
// Single source of truth for values referenced in multiple files.

export const SUPPORT_EMAIL = 'brittanyapps@outlook.com';
export const SUPPORT_RESPONSE_TIME = '24–48 hours';
export const DATA_REQUEST_RESPONSE_TIME = 'Within 30 days';

export const KEEPSAKE_CATEGORY_COLORS = Object.freeze({
  position: '#B91F2D',
  prompt: '#3E63C9',
  date: '#2D7A59',
  memory: '#7152C7',
});

export const REMINDER_CATEGORY_COLORS = Object.freeze({
  prompt: KEEPSAKE_CATEGORY_COLORS.prompt,
  quiz: '#2F7FAE',
  date: KEEPSAKE_CATEGORY_COLORS.date,
  intimacy: KEEPSAKE_CATEGORY_COLORS.position,
  journal: '#B8732A',
  memory: KEEPSAKE_CATEGORY_COLORS.memory,
});
