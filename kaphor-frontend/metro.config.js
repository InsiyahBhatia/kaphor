const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: { experimentalImportSupport: false, inlineRequires: true },
  }),
};

// Force Metro to resolve zustand to CJS files so that import.meta is completely avoided in browser/web bundles
const zustandRoot = path.resolve(__dirname, 'node_modules/zustand');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand') {
    return {
      filePath: path.join(zustandRoot, 'index.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/vanilla') {
    return {
      filePath: path.join(zustandRoot, 'vanilla.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/middleware') {
    return {
      filePath: path.join(zustandRoot, 'middleware.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/shallow') {
    return {
      filePath: path.join(zustandRoot, 'shallow.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'zustand/traditional') {
    return {
      filePath: path.join(zustandRoot, 'traditional.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
