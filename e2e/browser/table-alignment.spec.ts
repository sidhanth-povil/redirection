import { test, expect } from '@playwright/test';
import { logIn } from './login';

/**
 * Number columns: the header sits over its right-aligned numbers, not at the column's left edge.
 */

const APP = '/wp-admin/admin.php?page=dsuite-redirects.php';

test( 'number column headers are right-aligned like their cells', async ( { page } ) => {
	await page.setViewportSize( { width: 1440, height: 900 } );
	await logIn( page, APP + '#/groups' );

	// Groups always has the default groups, so the table renders without seeding data.
	const header = page.locator( '.dsr-table th.dsr-num' ).first();
	const cell = page.locator( '.dsr-table td.dsr-num' ).first();
	await expect( cell ).toBeVisible();

	await expect( header ).toHaveCSS( 'text-align', 'right' );
	await expect( cell ).toHaveCSS( 'text-align', 'right' );
} );
