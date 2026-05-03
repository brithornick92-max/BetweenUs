// config/constants.js — App-wide constants
// Single source of truth for values referenced in multiple files.

export const SUPPORT_EMAIL = 'brittanyapps@outlook.com';
export const SUPPORT_RESPONSE_TIME = '24–48 hours';
export const DATA_REQUEST_RESPONSE_TIME = 'Within 30 days';

export const KEEPSAKE_CATEGORY_COLORS = Object.freeze({
  position: '#D2121A',
  prompt: '#4F7DF3',
  date: '#2FA36B',
  memory: '#8A5CF6',
});

export const REMINDER_CATEGORY_COLORS = Object.freeze({
  prompt: KEEPSAKE_CATEGORY_COLORS.prompt,
  quiz: '#32ADE6',
  date: KEEPSAKE_CATEGORY_COLORS.date,
  intimacy: KEEPSAKE_CATEGORY_COLORS.position,
  journal: '#FF9F0A',
  memory: KEEPSAKE_CATEGORY_COLORS.memory,
});
