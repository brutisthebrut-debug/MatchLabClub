const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver = config.resolver || {};
config.resolver.blockList = [/\.cache\/openid-client\/.*/];

module.exports = config;
