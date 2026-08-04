import { defineConfig, devices } from "@playwright/test";

// The validation workflow runs `playwright test` directly. Boot both services
// and use Vite's /api proxy so this suite works on a laptop or in GitHub
// Actions without Replit's shared localhost:80 proxy.
const API_PORT = 8080;
const WEB_PORT = 21668;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    baseURL,
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
        APP_ORIGINS: process.env.APP_ORIGINS ?? baseURL,
        SESSION_SECRET:
          process.env.SESSION_SECRET ?? "matchlab-e2e-session-secret",
      },
      url: `http://127.0.0.1:${API_PORT}/api/healthz`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm --filter @workspace/nldc run dev",
      env: {
        PORT: String(WEB_PORT),
        HOST: "127.0.0.1",
        BASE_PATH: "/",
        API_ORIGIN: `http://127.0.0.1:${API_PORT}`,
      },
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
