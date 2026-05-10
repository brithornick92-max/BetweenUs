const promptsCatalog = require('../content/prompts.json');
const todayPromptsCatalog = require('../content/today-between-us-prompts.json');
const datesCatalog = require('../content/dates.json');
const positionsCatalog = require('../content/intimacy-positions.json');
const quizCatalog = require('../content/quizQuestions.json');

const MAX_EXAMPLES = 12;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryText(item) {
  return item?.text || item?.title || item?.question || '';
}

function labelFor(item, index) {
  const id = item?.id || item?.questionId || `index:${index}`;
  const title = item?.title || item?.text || item?.question || '';
  const preview = String(title).replace(/\s+/g, ' ').slice(0, 72);
  return `${id}${preview ? ` "${preview}"` : ''}`;
}

function collectDuplicates(items, keyFn) {
  const seen = new Map();

  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const key = keyFn(item, index);
    if (!key) return;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(labelFor(item, index));
  });

  return [...seen.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => ({ key, entries }));
}

function addDuplicateCheck(issues, label, items, keyFn) {
  const duplicates = collectDuplicates(items, keyFn);
  if (!duplicates.length) return;

  issues.push({
    label,
    duplicates,
  });
}

function fieldValue(item, field) {
  const value = item?.[field];
  if (Array.isArray(value)) return value.join(' ');
  return value;
}

const catalogChecks = [
  {
    name: 'prompts',
    items: promptsCatalog.items || [],
    fields: ['text'],
  },
  {
    name: 'today-between-us prompts',
    items: todayPromptsCatalog.items || [],
    fields: ['text'],
  },
  {
    name: 'daily quiz questions',
    items: quizCatalog.questions || [],
    fields: ['text'],
  },
  {
    name: 'dates',
    items: datesCatalog.items || [],
    fields: ['title', 'description', 'setup'],
  },
  {
    name: 'intimacy positions',
    items: positionsCatalog.items || [],
    fields: ['title', 'focus', 'howTo'],
  },
];

const issues = [];

catalogChecks.forEach(({ name, items, fields }) => {
  addDuplicateCheck(issues, `${name}: duplicate ids`, items, (item) => item?.id || item?.questionId || null);

  fields.forEach((field) => {
    addDuplicateCheck(
      issues,
      `${name}: duplicate exact ${field}`,
      items,
      (item) => String(fieldValue(item, field) || '').trim()
    );
    addDuplicateCheck(
      issues,
      `${name}: duplicate normalized ${field}`,
      items,
      (item) => normalizeText(fieldValue(item, field))
    );
    addDuplicateCheck(
      issues,
      `${name}: duplicate normalized ${field} first 80 chars`,
      items,
      (item) => {
        const normalized = normalizeText(fieldValue(item, field));
        return normalized.length >= 40 ? normalized.slice(0, 80) : '';
      }
    );
  });
});

const questionSurfaces = [
  ...(promptsCatalog.items || []).map((item) => ({ ...item, id: `prompts:${item.id}` })),
  ...(todayPromptsCatalog.items || []).map((item) => ({ ...item, id: `today-between-us:${item.id}` })),
  ...(quizCatalog.questions || []).map((item) => ({ ...item, id: `daily-quiz:${item.id}` })),
];

addDuplicateCheck(
  issues,
  'question surfaces: duplicate normalized text across prompts, Today Between Us, and quiz',
  questionSurfaces,
  (item) => normalizeText(primaryText(item))
);

if (issues.length) {
  console.error('\nContent integrity audit failed.\n');
  issues.forEach((issue) => {
    console.error(`- ${issue.label}`);
    issue.duplicates.slice(0, MAX_EXAMPLES).forEach((duplicate) => {
      console.error(`  "${duplicate.key}"`);
      duplicate.entries.forEach((entry) => console.error(`    ${entry}`));
    });
    if (issue.duplicates.length > MAX_EXAMPLES) {
      console.error(`  ...and ${issue.duplicates.length - MAX_EXAMPLES} more duplicate groups`);
    }
  });
  process.exitCode = 1;
} else {
  const totals = Object.fromEntries(catalogChecks.map(({ name, items }) => [name, items.length]));
  console.log('Content integrity audit passed.');
  console.log(JSON.stringify(totals, null, 2));
}
