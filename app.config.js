const { expo: baseConfig } = require('./app.json');

const APP_VARIANT = process.env.APP_VARIANT ?? 'production';
const isDevVariant = APP_VARIANT === 'development';
const isPreviewVariant = APP_VARIANT === 'preview';

let name = baseConfig.name;
let scheme = baseConfig.scheme;
let iosBundleIdentifier = baseConfig.ios?.bundleIdentifier;
let androidPackage = baseConfig.android?.package;

if (isDevVariant) {
  name = 'Between Us Dev';
  scheme = 'betweenus-dev';
  iosBundleIdentifier = 'com.brittany.betweenus.dev';
  androidPackage = 'com.brittany.betweenus.dev';
} else if (isPreviewVariant) {
  name = 'Between Us Preview';
  scheme = 'betweenus-preview';
  iosBundleIdentifier = 'com.brittany.betweenus.preview';
  androidPackage = 'com.brittany.betweenus.preview';
}

module.exports = () => ({
  ...baseConfig,
  name,
  scheme,
  ios: {
    ...baseConfig.ios,
    bundleIdentifier: iosBundleIdentifier,
  },
  android: {
    ...baseConfig.android,
    package: androidPackage,
  },
  extra: {
    ...baseConfig.extra,
    appVariant: APP_VARIANT,
  },
});
