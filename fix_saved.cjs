const fs = require('fs');
let text = fs.readFileSync('screens/SavedMomentsScreen.js', 'utf8');

// 1. Remove paddingHorizontal from listContent
text = text.replace(
  /listContent: \{\s*paddingHorizontal: SPACING\.screen,/g,
  'listContent: {\n    paddingHorizontal: 0,'
);

// 2. Wrap blur styles in `editorialCard` equivalents
// cardContainer
text = text.replace(
  /style=\{\[styles\.cardContainer,\s*isMemory && styles\.cardTimeline,\s*getShadow\(isDark\)\]\}/g,
  "style={[styles.cardContainer, isMemory && styles.cardTimeline]}"
);
text = text.replace(
  /<BlurView intensity=\{isDark \? 55 : 30\} tint=\{isDark \? 'dark' : 'light'\} style=\{styles\.cardBlur\}>/g,
  "<View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>"
);

// heroCardContainer
text = text.replace(
  /style=\{\[styles\.heroCardContainer,\s*getShadow\(isDark\)\]\}/g,
  "style={styles.heroCardContainer}"
);
text = text.replace(
  /<BlurView intensity=\{isDark \? 65 : 45\} tint=\{isDark \? 'dark' : 'light'\} style=\{styles\.heroCardBlur\}>/g,
  "<View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass }, !isDark && styles.lightShadow]}>"
);

// onThisDayContainer
text = text.replace(
  /style=\{\[styles\.onThisDayContainer,\s*getShadow\(isDark\)\]\}/g,
  "style={styles.onThisDayContainer}"
);
text = text.replace(
  /<BlurView intensity=\{isDark \? 55 : 30\} tint=\{isDark \? 'dark' : 'light'\} style=\{\[styles\.onThisDayCard, \{ borderColor: withAlpha\(t\.primary, 0\.15\) \}\]\}>/g,
  "<View style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: withAlpha(t.primary, 0.15) }, !isDark && styles.lightShadow]}>"
);

// Match end tags
text = text.replace(/<\/BlurView>/g, "</View>");

// 3. Inject editorial card styles
text = text.replace(
  /const createStyles = \(t, isDark\) => StyleSheet\.create\(\{/,
  `const createStyles = (t, isDark) => StyleSheet.create({
  editorialCard: {
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  editorialCardColumn: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  cardContent: {
    width: '100%',
  },
  lightShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },`
);

// 4. Optionally remove BlurView import -- no, it might be used for the FAB
// Let's check FAB: `      <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={[styles.fabBlur, { backgroundColor: withAlpha(t.primary, 0.8) }]}>`
// The FAB still uses BlurView. Better keep the import!

fs.writeFileSync('screens/SavedMomentsScreen.js', text);
