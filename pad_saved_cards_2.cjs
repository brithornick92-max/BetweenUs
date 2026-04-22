const fs = require('fs');
let text = fs.readFileSync('screens/SavedMomentsScreen.js', 'utf8');

// The first script didn't apply the padding to the heroCard and onThisDayCard bodies correctly yet
text = text.replace(
  /<View style=\{styles\.heroEyebrowRow\}>/g,
  "<View style={{ padding: SPACING.xl, width: '100%' }}>\n            <View style={styles.heroEyebrowRow}>"
);

// Close tag fix for heroic card body
text = text.replace(
  /Browse earlier reflections, shared journal entries, and captured moments without leaving the app's main rhythm\.\n          <\/Text>\n        <\/View>\n      <\/View>/g,
  "Browse earlier reflections, shared journal entries, and captured moments without leaving the app's main rhythm.\n          </Text>\n          </View>\n        </View>\n      </View>"
);

fs.writeFileSync('screens/SavedMomentsScreen.js', text);
