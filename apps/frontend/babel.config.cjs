// .cjs because apps/frontend/package.json sets "type": "module", where a
// babel.config.js with module.exports would load as ESM and fail. Babel
// resolves babel.config.cjs as a root config the same way.
module.exports = {
  presets: ["babel-preset-expo"],
};
