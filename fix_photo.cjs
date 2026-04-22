const fs = require('fs');
let text = fs.readFileSync('screens/SavedMomentsScreen.js', 'utf8');

text = text.replace(
  /photoWrapper: \{\n    borderRadius: 16,\n    overflow: 'hidden',\n    marginBottom: SPACING\.md,\n    position: 'relative',\n  \},/g,
  "photoWrapper: {\n    borderTopLeftRadius: 28,\n    borderTopRightRadius: 28,\n    borderBottomLeftRadius: 0,\n    borderBottomRightRadius: 0,\n    overflow: 'hidden',\n    marginBottom: 0,\n    position: 'relative',\n    width: '100%',\n  },"
);

text = text.replace(
  /photoThumb: \{\n    width: '100%',\n    height: 180,\n    borderRadius: 16,\n  \},/g,
  "photoThumb: {\n    width: '100%',\n    height: 180,\n    borderTopLeftRadius: 28,\n    borderTopRightRadius: 28,\n  },"
);

text = text.replace(
  /photoOverlay: \{\n    \.\.\.StyleSheet\.absoluteFillObject,\n    borderRadius: 16,\n  \},/g,
  "photoOverlay: {\n    ...StyleSheet.absoluteFillObject,\n    borderTopLeftRadius: 28,\n    borderTopRightRadius: 28,\n  },"
);
fs.writeFileSync('screens/SavedMomentsScreen.js', text);
