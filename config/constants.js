// config/constants.js — App-wide constants
// Single source of truth for values referenced in multiple files.

export const APP_OPERATOR = 'Brittany Apps';
export const SUPPORT_EMAIL = 'hello@brittanyapps.com';
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

export const HEAT_LEVEL_ACCENTS = Object.freeze({
  1: '#9B2F64',
  2: '#A31655',
  3: '#9A123F',
  4: '#B01635',
  5: '#8E0D12',
});

export const HEAT_LEVEL_GRADIENTS = Object.freeze({
  1: Object.freeze(['#8E2E59', '#5A1936']),
  2: Object.freeze(['#A31655', '#6D0E35']),
  3: Object.freeze(['#9A123F', '#640A27']),
  4: Object.freeze(['#B01635', '#70091F']),
  5: Object.freeze(['#8E0D12', '#4A0508']),
});
