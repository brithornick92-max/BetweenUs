// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Expo SDK 54+ handles Reanimated/Worklets via babel-preset-expo when installed correctly.
    // Do NOT add 'react-native-reanimated/plugin' unless you specifically need it.
  };
};
