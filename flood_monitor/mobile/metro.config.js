const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.unstable_allowRequireContext = true;
config.resolver.unstable_enablePackageExports = true;

config.resolver.transformIgnorePatterns = [
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|@tanstack/.*))',
];

if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}

module.exports = config;
