// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const plugins = [];

  // Strip console.log (but keep console.warn and console.error) in production builds.
  // Prevents leaking internal state, PII, or debug traces to device logs.
  if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
    plugins.push([
      'transform-remove-console',
      { exclude: ['error', 'warn'] },
    ]);
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
    // Expo SDK 54+ handles Reanimated/Worklets via babel-preset-expo when installed correctly.
    // Do NOT add 'react-native-reanimated/plugin' unless you specifically need it.
  };
};
