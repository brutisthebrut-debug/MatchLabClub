import { defineConfig, devices } from "@playwright/test";

// The validation workflow runs `playwright test` directly without first
// starting the API server or the web frontend. Boot both as webServers so
// they're available at the Replit shared proxy (localhost:80) before any
// spec runs. The proxy itself is part of the Replit environment and routes
// /api -> the API server on 8080 and / -> the Vite dev server.
const API_PORT = 8080;
const WEB_PORT = 21668;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:80",
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
      url: `http://localhost:${API_PORT}/api/healthz`,
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
      },
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
