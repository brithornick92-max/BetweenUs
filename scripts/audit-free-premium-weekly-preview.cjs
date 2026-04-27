const fs = require('fs');
const path = require('path');

(async () => {
  const weeklyService = await import('../services/WeeklyContentSetService.js');

  const { CONTENT_TYPES, buildWeeklySet } = weeklyService;

  const readJson = (relativePath) =>
    JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'));

  const promptsJson = readJson('content/prompts.json');
  const datesJson = readJson('content/dates.json');
  const positionsJson = readJson('content/intimacy-positions.json');

  const prompts = promptsJson.items || promptsJson.prompts || [];
  const dates = datesJson.items || datesJson.dates || [];
  const positions = positionsJson.items || positionsJson.positions || [];

  const collections = [
    [CONTENT_TYPES.PROMPTS, prompts],
    [CONTENT_TYPES.DATES, dates],
    [CONTENT_TYPES.POSITIONS, positions],
  ];

  const userSettings = { maxHeat: 5 };
  const userId = 'demo-user';

  for (const [contentType, items] of collections) {
    console.log('\n' + '='.repeat(90));
    console.log(contentType.toUpperCase());
    console.log('='.repeat(90));

    const premiumSet = buildWeeklySet(items, {
      contentType,
      userId,
      isPremium: true,
      userSettings,
      date: new Date(),
    });

    const freeSet = buildWeeklySet(items, {
      contentType,
      userId,
      isPremium: false,
      userSettings,
      date: new Date(),
    });

    console.log(`Premium library total: ${premiumSet.premiumLibraryTotal}`);
    console.log(`Premium weekly unlocked: ${premiumSet.unlocked.length}`);
    console.log(`Free weekly unlocked: ${freeSet.unlocked.length}`);
    console.log(`Free locked previews: ${freeSet.lockedPreviews.length}`);
    console.log('');
    console.log('Upgrade copy:');
    console.log(`- ${freeSet.upgradeCopy.headline}`);
    console.log(`- ${freeSet.upgradeCopy.body}`);
    console.log(`- CTA: ${freeSet.upgradeCopy.cta}`);

    console.log('');
    console.log('FREE SURFACE:');
    freeSet.items.forEach((item) => {
      const state = item.isLockedPreview ? 'LOCKED' : 'UNLOCKED';
      const label = item.title || item.text || item.prompt;
      const meta = [
        `heat ${item.heat ?? item.heatLevel ?? item.level}`,
        contentType !== CONTENT_TYPES.DATES ? item.category : null,
        item.load ? `load ${item.load}` : null,
        item.style,
        item.accessibility,
      ]
        .filter(Boolean)
        .join(' | ');

      console.log(`- ${state} | ${meta} | ${label}`);

      if (item.isLockedPreview && item.previewText) {
        console.log(`  preview: ${item.previewText}`);
      }
    });

    console.log('');
    console.log('PREMIUM WEEKLY SET:');
    premiumSet.items.forEach((item) => {
      const label = item.title || item.text || item.prompt;
      const meta = [
        `heat ${item.heat ?? item.heatLevel ?? item.level}`,
        contentType !== CONTENT_TYPES.DATES ? item.category : null,
        item.load ? `load ${item.load}` : null,
        item.style,
        item.accessibility,
      ]
        .filter(Boolean)
        .join(' | ');

      console.log(`- ${meta} | ${label}`);
    });
  }
})();
