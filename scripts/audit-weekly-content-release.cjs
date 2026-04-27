const fs = require('fs');
const path = require('path');

const CONTENT_FILES = [
  {
    label: 'Prompts',
    file: 'content/prompts.json',
    itemKeys: ['items', 'prompts'],
  },
  {
    label: 'Dates',
    file: 'content/dates.json',
    itemKeys: ['items', 'dates'],
  },
  {
    label: 'Positions',
    file: 'content/intimacy-positions.json',
    itemKeys: ['items', 'positions'],
  },
];

function loadItems(config) {
  const fullPath = path.join(process.cwd(), config.file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

  if (Array.isArray(data)) return { data, items: data };

  for (const key of config.itemKeys) {
    if (Array.isArray(data[key])) {
      return { data, items: data[key] };
    }
  }

  return { data, items: [] };
}

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item) ?? 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getHeat(item) {
  return item.heat ?? item.heatLevel ?? item.level ?? 'missing';
}

function getCategory(item) {
  return item.category ?? item.type ?? item.vibe ?? item.theme ?? 'missing';
}

function getReleaseWeek(item) {
  return item.releaseWeek ?? item.week ?? item.unlockWeek ?? 'missing';
}

function idNumber(id) {
  const match = String(id || '').match(/(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function summarizeWeeks(items) {
  const byWeek = countBy(items, getReleaseWeek);

  const numericWeeks = Object.keys(byWeek)
    .filter((week) => week !== 'missing' && !Number.isNaN(Number(week)))
    .map(Number)
    .sort((a, b) => a - b);

  const minWeek = numericWeeks.length ? numericWeeks[0] : null;
  const maxWeek = numericWeeks.length ? numericWeeks[numericWeeks.length - 1] : null;

  return { byWeek, numericWeeks, minWeek, maxWeek };
}

function printRollingBlocks(label, items, blockSize = 10) {
  const weekItems = items.filter((item) => {
    const week = getReleaseWeek(item);
    return week !== 'missing' && !Number.isNaN(Number(week)) && Number(week) > 0;
  });

  const weeks = weekItems.map((item) => Number(getReleaseWeek(item)));
  if (!weeks.length) {
    console.log('No numeric releaseWeek values above 0.');
    return;
  }

  const min = Math.min(...weeks);
  const max = Math.max(...weeks);

  for (let start = min; start <= max; start += blockSize) {
    const end = start + blockSize - 1;
    const window = weekItems.filter((item) => {
      const week = Number(getReleaseWeek(item));
      return week >= start && week <= end;
    });

    const heats = [...new Set(window.map(getHeat))].sort((a, b) => Number(a) - Number(b));
    const categories = [...new Set(window.map(getCategory))].sort();

    console.log(
      `weeks ${start}-${end}: ${window.length} items | heats ${heats.join(', ') || 'none'} | categories ${categories.join(', ') || 'none'}`
    );
  }
}

for (const config of CONTENT_FILES) {
  const { data, items } = loadItems(config);
  const ids = items.map((item) => item.id);
  const titles = items.map((item) => item.title ?? item.text ?? item.prompt);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const duplicateTitles = titles.filter((title, index) => title && titles.indexOf(title) !== index);

  const releaseSummary = summarizeWeeks(items);

  const sortedByRelease = [...items].sort((a, b) => {
    const weekA = Number(getReleaseWeek(a) ?? 999999);
    const weekB = Number(getReleaseWeek(b) ?? 999999);

    if (Number.isNaN(weekA) && Number.isNaN(weekB)) return idNumber(a.id) - idNumber(b.id);
    if (Number.isNaN(weekA)) return 1;
    if (Number.isNaN(weekB)) return -1;
    if (weekA !== weekB) return weekA - weekB;

    return idNumber(a.id) - idNumber(b.id);
  });

  console.log('\n' + '='.repeat(90));
  console.log(config.label);
  console.log('='.repeat(90));
  console.log('File:', config.file);
  console.log('Total:', items.length);
  console.log('Meta keys:', data && !Array.isArray(data) ? Object.keys(data) : []);
  console.log('Meta total:', data?.meta?.totalPrompts ?? data?.meta?.totalDates ?? data?.meta?.totalPositions ?? data?.meta?.total ?? 'missing');
  console.log('By heat:', countBy(items, getHeat));
  console.log('By category:', countBy(items, getCategory));
  console.log('By releaseWeek:', releaseSummary.byWeek);
  console.log('Release week min/max:', releaseSummary.minWeek, releaseSummary.maxWeek);
  console.log('Duplicate IDs:', [...new Set(duplicateIds)]);
  console.log('Duplicate titles/text:', [...new Set(duplicateTitles)].slice(0, 20));
  console.log('');
  console.log('First 15 by releaseWeek:');
  sortedByRelease.slice(0, 15).forEach((item) => {
    console.log(
      `${item.id || 'no-id'} | w${getReleaseWeek(item)} | heat ${getHeat(item)} | ${getCategory(item)} | ${item.title || item.text || item.prompt || ''}`
    );
  });
  console.log('');
  console.log('Last 15 by releaseWeek:');
  sortedByRelease.slice(-15).forEach((item) => {
    console.log(
      `${item.id || 'no-id'} | w${getReleaseWeek(item)} | heat ${getHeat(item)} | ${getCategory(item)} | ${item.title || item.text || item.prompt || ''}`
    );
  });
  console.log('');
  console.log('Rolling 10-week variety:');
  printRollingBlocks(config.label, sortedByRelease, 10);
}
