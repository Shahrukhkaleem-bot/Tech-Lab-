import { defineConfig, devices } from "@playwright/test"

/**
 * E2E tests run against `next dev` + a local Supabase stack seeded with supabase/seed.sql:
 *   supabase start && npm run test:e2e
 * Tenants are addressed via *.localhost subdomains (resolved natively by Chromium).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share seeded stock
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://demo-electronics.localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /storefront\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.CI ? `npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
