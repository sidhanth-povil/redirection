import { test, expect } from '@playwright/test';
import { logIn } from './login';

/**
 * On a phone the day columns are narrow; every day's tooltip must still sit inside the chart card.
 */

const APP = '/wp-admin/admin.php?page=dsuite-redirects.php';

test( 'traffic tooltips stay inside the card at phone width', async ( { page } ) => {
	await page.setViewportSize( { width: 375, height: 800 } );
	await logIn( page, APP + '#/overview' );

	const days = page.locator( '.dsr-traffic__day' );
	await expect( days ).toHaveCount( 7 );
	const card = await page.locator( '.dsr-traffic' ).boundingBox();

	for ( let index = 0; index < 7; index++ ) {
		await days.nth( index ).focus();
		const tip = await page.getByRole( 'tooltip' ).boundingBox();

		expect( tip!.x, `day ${ index } left` ).toBeGreaterThanOrEqual( card!.x );
		expect( tip!.x + tip!.width, `day ${ index } right` ).toBeLessThanOrEqual( card!.x + card!.width );
	}
} );
