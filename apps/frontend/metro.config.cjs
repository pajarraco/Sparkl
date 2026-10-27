// .cjs because apps/frontend/package.json sets "type": "module", where a
// metro.config.js with require/module.exports would load as ESM and fail.
// Metro's config search (cosmiconfig) picks up metro.config.cjs the same
// way — same precedent as babel.config.cjs in this package.
// Enables package `exports` resolution so subpath imports like
// `@better-auth/expo/client` map to their files. Without the flag Metro
// falls back to file-path resolution and exports-only subpaths fail with
// "Unable to resolve".
const { getDefaultConfig } = require("@expo/metro-config");

const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    unstable_enablePackageExports: true,
  },
};
