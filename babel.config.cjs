// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const plugins = [];

  // Strip ALL console calls in production builds.
  // Debug logging is guarded with __DEV__ checks (dead-code-eliminated in prod).
  // Error telemetry goes through CrashReporting/Sentry, not console.
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push(['transform-remove-console']);
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
    // Expo SDK 54+ handles Reanimated/Worklets via babel-preset-expo when installed correctly.
    // Do NOT add 'react-native-reanimated/plugin' unless you specifically need it.
  };
};
