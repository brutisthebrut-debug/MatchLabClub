import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ["workspace"],
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  define: {
    __DEV__: false,
  },
  test: {
    include: ["lib/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: false,
  },
});
