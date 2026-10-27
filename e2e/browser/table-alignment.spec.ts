import { test, expect } from '@playwright/test';

/**
 * Number columns: the header sits over its right-aligned numbers, not at the column's left edge.
 */

const ADMIN_USER = process.env.WP_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.WP_PASSWORD ?? 'password';
const APP = '/wp-admin/admin.php?page=dsuite-redirects.php';

test( 'number column headers are right-aligned like their cells', async ( { page } ) => {
	await page.setViewportSize( { width: 1440, height: 900 } );
	await page.goto( '/wp-login.php?redirect_to=' + encodeURIComponent( APP + '#/groups' ) );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASSWORD );
	await page.click( '#wp-submit' );

	// Groups always has the default groups, so the table renders without seeding data.
	const header = page.locator( '.dsr-table th.dsr-num' ).first();
	const cell = page.locator( '.dsr-table td.dsr-num' ).first();
	await expect( cell ).toBeVisible();

	await expect( header ).toHaveCSS( 'text-align', 'right' );
	await expect( cell ).toHaveCSS( 'text-align', 'right' );
} );
