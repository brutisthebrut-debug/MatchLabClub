const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver = config.resolver || {};

/**
 * Block test files from being bundled.
 * Expo Router scans the entire `app/` tree for routes, which means
 * *.test.tsx / *.spec.tsx files inside `app/` are picked up and Metro
 * tries to transform them.  Those files import @testing-library/react
 * and other web-only test utilities that Metro cannot resolve in the
 * React Native context, causing an HTTP 500 bundling failure.
 * Blocking them here prevents Metro from ever touching them.
 */
config.resolver.blockList = [
  /\.cache\/openid-client\/.*/,
  /.*\.test\.[jt]sx?$/,
  /.*\.spec\.[jt]sx?$/,
  /.*\/e2e\/test-results\/.*/,
];

/**
 * Prevent server-only and test-only packages from being bundled by Metro.
 * vite/vitest are devDependencies used exclusively for running unit tests;
 * they must never appear in the iOS/Android/web bundle.  Without this guard,
 * a transitive import somewhere in the dependency graph pulls in
 * vite/dist/node/module-runner.js, which contains a bare `import(filepath)`
 * that Metro's Hermes-targeted transformer rejects with "Invalid call at
 * line N".  Returning { type: "empty" } replaces the module with a no-op
 * stub so the bundle succeeds.
 */
const TEST_BUILD_TOOL_PREFIXES = ["vite", "vite/", "vitest", "vitest/", "@vitejs/", "@testing-library/"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (TEST_BUILD_TOOL_PREFIXES.some((prefix) => moduleName === prefix || moduleName.startsWith(prefix + "/"))) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
