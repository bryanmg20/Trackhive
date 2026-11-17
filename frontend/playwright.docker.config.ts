import { defineConfig, devices } from '@playwright/test';

/** Real API through Nginx. Run after `docker compose up -d --build`. */
export default defineConfig({
  testDir: './e2e-docker',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:8080',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
  },
});
