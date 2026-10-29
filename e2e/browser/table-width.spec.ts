import { test, expect } from '@playwright/test';

/**
 * The Redirect column must stay readable at laptop widths. The fixed columns (type, hits, last hit, actions) once
 * squeezed it to nothing at about 1035px, because the card layout keyed off the whole app, sidebar included.
 */

const ADMIN_USER = process.env.WP_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.WP_PASSWORD ?? 'password';
const APP = '/wp-admin/admin.php?page=dsuite-redirects.php';
const MIN_SOURCE_WIDTH = 150;

test( 'the old URL stays readable at laptop and desktop widths', async ( { page } ) => {
	await page.goto( '/wp-login.php?redirect_to=' + encodeURIComponent( APP + '#/redirects' ) );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASSWORD );
	await page.click( '#wp-submit' );

	const source = page.locator( '.dsr-table .dsr-table__source' ).first();
	await expect( source ).toBeVisible();

	for ( const width of [ 1035, 1280, 1440 ] ) {
		await page.setViewportSize( { width, height: 900 } );

		const box = await page.locator( '.dsr-table .dsr-table__redirect' ).first().boundingBox();
		expect( box?.width ?? 0, `Redirect column at ${ width }px` ).toBeGreaterThanOrEqual( MIN_SOURCE_WIDTH );
	}
} );
