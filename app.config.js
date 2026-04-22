export default ({ config }) => {
  const variant = process.env.APP_VARIANT ?? "production";
  const isDevelopment = variant === "development";
  const isPreview = variant === "preview";

  let name = "Between Us";
  let scheme = "betweenus";
  let bundleIdentifier = "com.brittany.betweenus";
  let androidPackage = "com.brittany.betweenus";

  if (isDevelopment) {
    name = "Between Us Dev";
    scheme = "betweenusdev";
    bundleIdentifier = "com.brittany.betweenus.dev";
    androidPackage = "com.brittany.betweenus.dev";
  } else if (isPreview) {
    name = "Between Us Preview";
    scheme = "betweenuspreview";
    bundleIdentifier = "com.brittany.betweenus.preview";
    androidPackage = "com.brittany.betweenus.preview";
  }

  return {
    ...config,
    name,
    scheme,
    ios: {
      ...config.ios,
      bundleIdentifier
    },
    android: {
      ...config.android,
      package: androidPackage
    },
    extra: {
      ...config.extra,
      appName: name,
      appVariant: variant
    }
  };
};
