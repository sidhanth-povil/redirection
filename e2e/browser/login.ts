import { expect, type Page } from '@playwright/test';

const ADMIN_USER = process.env.WP_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.WP_PASSWORD ?? 'password';

/**
 * Log in as the admin and land on `redirectTo`.
 *
 * wp-login.php focuses and selects the username field a moment after load, so typing straight away can land in the
 * wrong field. Wait for the page to settle, confirm both fields hold what was typed, then wait for the admin.
 *
 * @param page       Playwright page.
 * @param redirectTo Admin path to land on after logging in.
 */
export async function logIn( page: Page, redirectTo: string ): Promise< void > {
	await page.goto( '/wp-login.php?redirect_to=' + encodeURIComponent( redirectTo ) );
	await page.waitForLoadState( 'networkidle' );

	const user = page.locator( '#user_login' );
	const pass = page.locator( '#user_pass' );
	await user.fill( ADMIN_USER );
	await pass.fill( ADMIN_PASSWORD );
	await expect( user ).toHaveValue( ADMIN_USER );
	await expect( pass ).toHaveValue( ADMIN_PASSWORD );

	await Promise.all( [ page.waitForURL( /\/wp-admin\// ), page.click( '#wp-submit' ) ] );
}
