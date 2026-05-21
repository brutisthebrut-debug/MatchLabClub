import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ["workspace"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: false,
    // CI runs all integration suites in the same process and the larger
    // page-rendering tests (e.g. aiFallback's Blueprint driver, which imports
    // the full Blueprint page tree) can take >5s under contention. Default
    // findBy* timeout is 1s and default testTimeout is 5s — bumping the test
    // timeout removes the parallel-run flake without masking real hangs.
    testTimeout: 20000,
  },
});
