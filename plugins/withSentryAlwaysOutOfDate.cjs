/**
 * Custom Expo config plugin: withSentryAlwaysOutOfDate
 *
 * Adds `alwaysOutOfDate = 1` to the "Upload Debug Symbols to Sentry" build
 * phase so Xcode knows it is intentionally set to run on every build.
 * Without this, Xcode emits a warning because the script has no declared
 * outputs and dependency analysis is enabled.
 *
 * This survives every `expo prebuild` run since it is applied as a config plugin.
 */

const { withXcodeProject } = require('@expo/config-plugins');

const withSentryAlwaysOutOfDate = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const shellScriptBuildPhases = project.hash.project.objects['PBXShellScriptBuildPhase'] || {};

    for (const [, phase] of Object.entries(shellScriptBuildPhases)) {
      if (typeof phase === 'object' && phase.name === '"Upload Debug Symbols to Sentry"') {
        phase.alwaysOutOfDate = 1;
      }
    }

    return cfg;
  });

module.exports = withSentryAlwaysOutOfDate;
