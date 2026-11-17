import { defineConfig, devices } from '@playwright/test';

/** Integration against the real API through Nginx, after docker compose up. */
export default defineConfig({
  testDir: './e2e-docker',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:8080',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
});
