const { expo: baseConfig } = require('./app.json');

const requestedVariant = process.env.APP_VARIANT || 'production';

const variants = {
  production: {
    name: baseConfig.name,
    scheme: baseConfig.scheme,
    iosBundleIdentifier: 'com.brittany.betweenus',
    androidPackage: 'com.brittany.betweenus',
  },
  development: {
    name: 'Between Us Dev',
    scheme: 'betweenus-dev',
    iosBundleIdentifier: 'com.brittany.betweenus.dev',
    androidPackage: 'com.brittany.betweenus.dev',
  },
  preview: {
    name: 'Between Us Preview',
    scheme: 'betweenus-preview',
    iosBundleIdentifier: 'com.brittany.betweenus.preview',
    androidPackage: 'com.brittany.betweenus.preview',
  },
};

const selectedVariantName = Object.prototype.hasOwnProperty.call(variants, requestedVariant)
  ? requestedVariant
  : 'production';
const selectedVariant = variants[selectedVariantName];

module.exports = ({ config }) => {
  const mergedConfig = {
    ...config,
    ...baseConfig,
  };

  return {
    ...mergedConfig,
    name: selectedVariant.name,
    scheme: selectedVariant.scheme,
    ios: {
      ...mergedConfig.ios,
      bundleIdentifier: selectedVariant.iosBundleIdentifier,
    },
    android: {
      ...mergedConfig.android,
      package: selectedVariant.androidPackage,
    },
    extra: {
      ...mergedConfig.extra,
      appVariant: selectedVariantName,
    },
  };
};
