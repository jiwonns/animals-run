const { getDefaultConfig } = require('expo/metro-config');

const gacha = require('./scripts/generate-gacha');

gacha.generate();
gacha.watch();

module.exports = getDefaultConfig(__dirname);
