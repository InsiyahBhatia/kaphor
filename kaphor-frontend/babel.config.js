module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      function () {
        return {
          visitor: {
            MetaProperty(path) {
              path.replaceWithSourceString('({ env: { MODE: process.env.NODE_ENV || "development" } })');
            },
          },
        };
      },
      'react-native-reanimated/plugin',
    ],
  };
};
