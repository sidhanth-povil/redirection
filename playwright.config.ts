import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E against wp-env (`pnpm wp-env:start`). The older HTTP-only suite in e2e/__tests__ runs under Jest.
 */
export default defineConfig( {
	testDir: './e2e/browser',
	timeout: 60_000,
	retries: 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: process.env.WP_BASE_URL ?? 'http://localhost:8888',
		trace: 'retain-on-failure',
		...devices[ 'Desktop Chrome' ],
		// Installed Google Chrome, so no browser download is needed. PW_CHANNEL=chromium uses Playwright's own build.
		channel: process.env.PW_CHANNEL ?? 'chrome',
	},
} );
