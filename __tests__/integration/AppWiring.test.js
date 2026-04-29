const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return fs.readFileSync(path.isAbsolute(relativePath) ? relativePath : path.join(repoRoot, relativePath), 'utf8');
}

function collectMatches(text, regex, groupIndex = 1) {
  return [...text.matchAll(regex)].map((match) => match[groupIndex]);
}

function collectAssetReferences(value, refs = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./assets/')) refs.push(value);
    return refs;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectAssetReferences(item, refs));
    return refs;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectAssetReferences(item, refs));
  }

  return refs;
}

describe('app wiring contracts', () => {
  it('keeps every app.json asset reference pointed at an existing file', () => {
    const appConfig = JSON.parse(readRepoFile('app.json'));
    const assetRefs = collectAssetReferences(appConfig);

    expect(assetRefs.length).toBeGreaterThan(0);
    for (const assetRef of assetRefs) {
      expect(fs.existsSync(path.join(repoRoot, assetRef))).toBe(true);
    }
  });

  it('keeps lazy screen registry entries pointed at existing modules', () => {
    const lazyScreens = readRepoFile('navigation/lazyScreens.js');
    const requiredModules = collectMatches(lazyScreens, /require\(["']([^"']+)["']\)/g);

    expect(requiredModules.length).toBeGreaterThan(0);
    for (const modulePath of requiredModules) {
      const normalized = modulePath.replace(/^\.\.\//, '');
      const absolute = path.join(repoRoot, normalized);
      const exists =
        fs.existsSync(absolute) ||
        fs.existsSync(`${absolute}.js`) ||
        fs.existsSync(`${absolute}.jsx`);

      expect(exists).toBe(true);
    }
  });

  it('keeps static navigation calls pointed at registered stack or tab routes', () => {
    const rootNavigator = readRepoFile('navigation/RootNavigator.js');
    const tabs = readRepoFile('navigation/Tabs.js');
    const validRoutes = new Set([
      ...collectMatches(rootNavigator, /<Stack\.Screen\s+name=["']([^"']+)["']/g),
      ...collectMatches(tabs, /<Tab\.Screen\s+name=["']([^"']+)["']/g),
    ]);

    const sourceDirs = ['screens', 'components', 'services', 'navigation'];
    const sourceFiles = sourceDirs.flatMap((dir) =>
      fs
        .readdirSync(path.join(repoRoot, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath || dir, entry.name))
        .filter((file) => /\.(js|jsx|ts|tsx)$/.test(file))
        .filter((file) => !file.includes('.bak'))
    );

    const navigationCalls = sourceFiles.flatMap((relativePath) => {
      const text = readRepoFile(relativePath);
      return collectMatches(text, /\b(?:navigation|_navigationRef)\.(?:navigate|push|replace)\(\s*["']([^"']+)["']/g).map((route) => ({
        route,
        relativePath,
      }));
    });

    expect(validRoutes.size).toBeGreaterThan(0);
    for (const { route, relativePath } of navigationCalls) {
      expect(validRoutes.has(route)).toBe(true);
    }
  });

  it('keeps deep-link route targets registered in navigation', () => {
    const rootNavigator = readRepoFile('navigation/RootNavigator.js');
    const tabs = readRepoFile('navigation/Tabs.js');
    const deepLinks = readRepoFile('services/DeepLinkHandler.js');
    const validRoutes = new Set([
      ...collectMatches(rootNavigator, /<Stack\.Screen\s+name=["']([^"']+)["']/g),
      ...collectMatches(tabs, /<Tab\.Screen\s+name=["']([^"']+)["']/g),
    ]);

    const deepLinkTargets = collectMatches(deepLinks, /screen:\s*["']([^"']+)["']/g);

    expect(deepLinkTargets.length).toBeGreaterThan(0);
    for (const route of deepLinkTargets) {
      expect(validRoutes.has(route)).toBe(true);
    }
  });
});
