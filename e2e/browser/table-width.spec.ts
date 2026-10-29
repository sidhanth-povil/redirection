import { test, expect } from '@playwright/test';
import { logIn } from './login';

/**
 * The Redirect column must stay readable at laptop widths. The fixed columns (type, hits, last hit, actions) once
 * squeezed it to nothing at about 1035px, because the card layout keyed off the whole app, sidebar included.
 */

const APP = '/wp-admin/admin.php?page=dsuite-redirects.php';
const MIN_SOURCE_WIDTH = 150;

test( 'the old URL stays readable at laptop and desktop widths', async ( { page } ) => {
	await logIn( page, APP + '#/redirects' );

	const source = page.locator( '.dsr-table .dsr-table__source' ).first();
	await expect( source ).toBeVisible();

	for ( const width of [ 1035, 1280, 1440 ] ) {
		await page.setViewportSize( { width, height: 900 } );

		const box = await page.locator( '.dsr-table .dsr-table__redirect' ).first().boundingBox();
		expect( box?.width ?? 0, `Redirect column at ${ width }px` ).toBeGreaterThanOrEqual( MIN_SOURCE_WIDTH );
	}
} );
