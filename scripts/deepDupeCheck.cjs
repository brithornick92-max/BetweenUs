const data = require('../content/dates.json');

// Group by heat+load combo and look for similar concepts
const byDimension = {};
data.items.forEach(item => {
  const key = 'heat' + item.heat + '/load' + item.load;
  if (!byDimension[key]) byDimension[key] = [];
  byDimension[key].push(item);
});

// Extract key themes from title + steps
function getThemes(item) {
  const text = (item.title + ' ' + item.steps.join(' ')).toLowerCase();
  const themes = [];
  const checks = [
    ['bath', /\b(bath|tub|bubble|soak)\b/],
    ['massage', /\b(massage|rub|knead)\b/],
    ['stargazing', /\b(star|constellation|night sky|telescope)\b/],
    ['cooking', /\b(cook|bak[ei]|recipe|kitchen|meal|pancake|dinner)\b/],
    ['dance', /\b(dance|danc|sway|slow.?dance)\b/],
    ['morning-bed', /\b(morning|wake|spoon|cuddle|bed)\b.*\b(bed|morning|wake|spoon|cuddle)\b/],
    ['letters-sealed', /\b(letter|write|seal|capsule|envelope|future)\b.*\b(seal|capsule|future|open|year)\b/],
    ['whisper', /\b(whisper|soft.?voice)\b/],
    ['meditation', /\b(meditat|mindful|guided|body scan|breathing sync)\b/],
    ['blindfold', /\b(blindfold|eyes closed|blind)\b/],
    ['reading-aloud', /\b(read.*aloud|reading.*together|read.*each)\b/],
    ['museum-art', /\b(museum|gallery|art show|exhibit)\b/],
    ['hiking', /\b(hik[ei]|trail|summit|mountain)\b/],
    ['treasure-hunt', /\b(treasure|scavenger|hunt|clue)\b/],
    ['skincare', /\b(skincare|facial|face mask|serum|moistur)\b/],
    ['journaling', /\b(journal|diary|write freely)\b/],
    ['yoga', /\b(yoga|pose|savasana|stretch)\b/],
    ['painting', /\b(paint|canvas|watercolor|portrait)\b/],
    ['nap-sleep', /\b(nap|sleep|cocoon|stay in bed)\b/],
  ];
  checks.forEach(([theme, regex]) => {
    if (regex.test(text)) themes.push(theme);
  });
  return themes;
}

console.log('=== CONCEPTUAL DUPLICATES BY DIMENSION ===\n');
let issues = 0;
Object.entries(byDimension).sort().forEach(([dim, items]) => {
  const themeGroups = {};
  items.forEach(item => {
    const themes = getThemes(item);
    themes.forEach(theme => {
      if (!themeGroups[theme]) themeGroups[theme] = [];
      themeGroups[theme].push(item);
    });
  });

  const dimIssues = [];
  Object.entries(themeGroups).forEach(([theme, group]) => {
    if (group.length >= 2) {
      dimIssues.push({ theme, group });
    }
  });

  if (dimIssues.length > 0) {
    console.log('[' + dim.toUpperCase() + ']');
    dimIssues.forEach(({ theme, group }) => {
      console.log('  Theme: "' + theme + '" (' + group.length + ' dates):');
      group.forEach(i => console.log('    ' + i.id + ': ' + i.title));
      if (group.length >= 3) {
        console.log('    ⚠️  ' + group.length + ' dates with same theme in same dimension — likely too many');
        issues++;
      }
    });
    console.log();
  }
});

console.log('Potential issues: ' + issues);
