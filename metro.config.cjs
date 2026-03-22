const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const path = require("path");

const config = getSentryExpoConfig(__dirname);

// Stub out ExponentPedometer so the app doesn't crash when expo-sensors is
// imported and the native Pedometer module is not linked in the current binary.
// Real fix: `cd ios && pod install` then rebuild.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes("ExponentPedometer") && platform === "ios") {
    return {
      filePath: path.resolve(__dirname, "mocks/ExponentPedometer.js"),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
