import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Playwright specs live in e2e/ and run with their own runner.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
