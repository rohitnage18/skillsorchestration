import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL || "";
const e2eEmail = process.env.E2E_TEST_EMAIL || "e2e-admin@example.com";
const usesExternalWebServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: usesExternalWebServer
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100/login",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_URL: e2eDatabaseUrl,
          AUTH_SECRET: "e2e-auth-secret-value-with-at-least-32-characters",
          AUTH_URL: "http://127.0.0.1:3100",
          AUTH_TRUST_HOST: "true",
          ADMIN_EMAILS: e2eEmail,
          ALLOW_FIRST_USER_ADMIN: "false",
          E2E_TEST_AUTH: "true",
          E2E_TEST_EMAIL: e2eEmail,
          SKILL_EVENTS_TOKEN: "e2e-skill-events-token-with-at-least-32-characters",
        },
      },
});
