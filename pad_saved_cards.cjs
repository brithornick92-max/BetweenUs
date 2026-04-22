const fs = require('fs');
let text = fs.readFileSync('screens/SavedMomentsScreen.js', 'utf8');

// 1. Make editorial cards have { padding: 0 } instead of relying on the stylesheet default
text = text.replace(
  /style=\{\[styles\.editorialCard, styles\.editorialCardColumn, \{ backgroundColor: t\.surface, borderColor: t\.borderGlass \}, !isDark && styles\.lightShadow\]\}/g,
  "style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: t.borderGlass, padding: 0 }, !isDark && styles.lightShadow]}"
);
text = text.replace(
  /style=\{\[styles\.editorialCard, styles\.editorialCardColumn, \{ backgroundColor: t\.surface, borderColor: withAlpha\(t\.primary, 0\.15\) \}, !isDark && styles\.lightShadow\]\}/g,
  "style={[styles.editorialCard, styles.editorialCardColumn, { backgroundColor: t.surface, borderColor: withAlpha(t.primary, 0.15), padding: 0 }, !isDark && styles.lightShadow]}"
);

// 2. Wrap the text-based parts in a `<View style={{ padding: SPACING.xl, width: '100%' }}>`
text = text.replace(
  /<View style=\{styles\.heroEyebrowRow\}>/g,
  "<View style={{ padding: SPACING.xl, width: '100%' }}>\n          <View style={styles.heroEyebrowRow}>"
);
text = text.replace(
  /without leaving the app's main rhythm\.\n          <\/Text>\n        <\/View>\n      <\/View>/g,
  "without leaving the app's main rhythm.\n          </Text>\n          </View>\n        </View>\n      </View>"
);

text = text.replace(
  /<View style=\{styles\.onThisDayLeft\}>/g,
  "<View style={{ padding: SPACING.lg, paddingVertical: SPACING.xl, flexDirection: 'row', alignItems: 'center', width: '100%' }}>\n              <View style={styles.onThisDayLeft}>"
);

text = text.replace(
  /<\/View>\n              <Icon name="chevron-forward" size=\{16\} color=\{t\.subtext\} \/>\n            <\/View>\n          <\/View>\n        <\/ReAnimated\.View>/g,
  "</View>\n              <Icon name=\"chevron-forward\" size={16} color={t.subtext} />\n              </View>\n            </View>\n          </View>\n        </ReAnimated.View>"
);

text = text.replace(
  /<View style=\{styles\.cardTopRow\}>/g,
  "<View style={{ paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, paddingTop: photoUri ? 0 : SPACING.xl, width: '100%' }}>\n            <View style={styles.cardTopRow}>"
);

text = text.replace(
  /\{ heartState\.count > 0 && \(\n                    <Text style=\{\[styles\.heartCount, \{ color: heartState\.hearted \? t\.primary : t\.subtext \}\]\}>\n                      \{heartState\.count\}\n                    <\/Text>\n                  \)\}\n                <\/TouchableOpacity>\n              <\/View>\n            <\/View>\n          <\/View>\n        <\/TouchableOpacity>/,
  "{ heartState.count > 0 && (\n                    <Text style={[styles.heartCount, { color: heartState.hearted ? t.primary : t.subtext }]}>\n                      {heartState.count}\n                    </Text>\n                  )}\n                </TouchableOpacity>\n              </View>\n            </View>\n            </View>\n          </View>\n        </TouchableOpacity>"
);

fs.writeFileSync('screens/SavedMomentsScreen.js', text);
