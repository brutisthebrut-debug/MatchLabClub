import { defineConfig, devices } from "@playwright/test";

const API_PORT = 8080;
const WEB_PORT = 21668;
const API_ORIGIN = `http://localhost:${API_PORT}`;
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? WEB_ORIGIN,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @workspace/api-server run dev",
      env: {
        PORT: String(API_PORT),
        DATABASE_URL: process.env.DATABASE_URL ?? "",
      },
      url: `${API_ORIGIN}/api/healthz`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @workspace/nldc run dev",
      env: {
        PORT: String(WEB_PORT),
        BASE_PATH: "/",
        API_PROXY_TARGET: API_ORIGIN,
      },
      url: `${WEB_ORIGIN}/`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
