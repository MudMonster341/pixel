// Browser tests: they start the dev server on a separate port and play the game in Chromium.
// Run: npm run test:e2e   (docs/TESTING.md)
const { defineConfig, devices } = require('@playwright/test');
const { PORT, FEEDBACK_DIR } = require('./tests/e2e/paths');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1, // the game is timing-sensitive; one at a time keeps results stable
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // 960x540 = the game's own resolution, so canvas pixels line up with page coordinates
      use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 540 } },
    },
  ],
  webServer: {
    command: 'node server.js',
    url: `http://127.0.0.1:${PORT}/`,
    env: { PORT: String(PORT), FEEDBACK_DIR },
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
