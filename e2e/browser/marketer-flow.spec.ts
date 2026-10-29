import { test, expect, type Page } from '@playwright/test';
import { logIn } from './login';

/**
 * Spec §8 marketer flow: Overview → Fix a 404 → drawer prefilled → pick a page → save → the URL now redirects.
 * Creates its own page and 404s, and removes them (plus the redirect) afterwards.
 */

const APP = '/wp-admin/admin.php?page=dsuite-redirects.php';
// Overview lists the top 10 404s by hits; existing dev data has far fewer than this per URL.
const HITS = 25;

const stamp = Date.now();
const missingPath = `/e2e-missing-${ stamp }`;
const pageTitle = `E2E Landing ${ stamp }`;

/**
 * Open the plugin page and wait for its config, which carries the REST root and nonce.
 *
 * @param page Playwright page.
 */
async function openApp( page: Page ) {
	if ( ! page.url().includes( 'page=dsuite-redirects.php' ) ) {
		await page.goto( APP );
	}

	await page.waitForFunction( () => Boolean( ( window as any ).Redirectioni10n?.api ) );
}

/**
 * REST call from inside the logged-in admin page, using the plugin's REST nonce.
 *
 * @param page   Playwright page, already on the plugin page.
 * @param path   Path under the REST root, e.g. `wp/v2/pages`.
 * @param method HTTP method.
 * @param body   JSON body.
 */
async function rest( page: Page, path: string, method = 'GET', body?: unknown ) {
	await openApp( page );

	return page.evaluate(
		async ( { path: restPath, method: restMethod, body: restBody } ) => {
			const api = ( window as any ).Redirectioni10n.api;
			const response = await fetch( api.WP_API_root + restPath, {
				method: restMethod,
				headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': api.WP_API_nonce },
				body: restBody === undefined ? undefined : JSON.stringify( restBody ),
			} );

			return { status: response.status, json: await response.json().catch( () => null ) };
		},
		{ path, method, body }
	);
}

let pageId = 0;
let permalink = '';

test.beforeEach( async ( { page } ) => {
	// Log in straight to the plugin page: the Dashboard's news widgets fetch from wordpress.org and can stall.
	await logIn( page, APP );
	await openApp( page );

	const created = await rest( page, 'wp/v2/pages', 'POST', { title: pageTitle, status: 'publish' } );
	expect( created.status ).toBe( 201 );
	pageId = created.json.id;
	permalink = created.json.link;

	for ( let hit = 0; hit < HITS; hit++ ) {
		const response = await page.request.get( missingPath, { maxRedirects: 0 } );
		expect( response.status() ).toBe( 404 );
	}
} );

test.afterEach( async ( { page } ) => {
	const redirects = await rest(
		page,
		`redirection/v1/redirect?filterBy%5Burl%5D=${ encodeURIComponent( missingPath ) }`
	);
	const ids = ( redirects.json?.items ?? [] ).map( ( item: { id: number } ) => item.id );

	if ( ids.length > 0 ) {
		await rest( page, 'redirection/v1/bulk/redirect/delete', 'POST', { items: ids } );
	}

	await rest( page, 'redirection/v1/bulk/404/delete', 'POST', { items: [ missingPath ], groupBy: 'url' } );

	if ( pageId ) {
		await rest( page, `wp/v2/pages/${ pageId }?force=true`, 'DELETE' );
	}
} );

test( 'a marketer fixes a 404 from Overview by picking a page', async ( { page } ) => {
	await page.goto( APP + '#/overview' );
	// beforeEach already opened the app (and fetched Overview) before the 404s existed; a hash change alone won't refetch.
	await page.reload();

	const row = page.locator( 'li, tr' ).filter( { hasText: missingPath } ).first();
	await expect( row ).toBeVisible();
	await row.getByRole( 'button', { name: 'Fix' } ).click();

	const drawer = page.getByRole( 'dialog' );
	await expect( drawer.getByLabel( 'Old URL' ) ).toHaveValue( missingPath );

	await drawer.getByLabel( 'Send visitors to' ).fill( pageTitle );
	await drawer.getByRole( 'option', { name: new RegExp( pageTitle ) } ).click();
	await drawer.getByRole( 'button', { name: 'Save redirect' } ).click();
	await expect( drawer ).toBeHidden();

	const response = await page.request.get( missingPath, { maxRedirects: 0 } );
	expect( response.status() ).toBe( 301 );
	// The drawer stores same-site targets as relative paths, so the Location header is relative too.
	expect( response.headers().location ).toBe( new URL( permalink ).pathname );
} );

test( 'a fixed 404 says where it goes, and a second redirect for it is refused', async ( { page } ) => {
	await page.goto( APP + '#/404s' );
	await page.reload();

	await page.getByRole( 'button', { name: 'All' } ).click();
	const row = page.locator( 'tr' ).filter( { hasText: missingPath } );
	await row.getByRole( 'button', { name: 'Fix' } ).click();

	const drawer = page.getByRole( 'dialog' );
	await drawer.getByLabel( 'Send visitors to' ).fill( '/e2e-target/' );
	await drawer.getByRole( 'button', { name: 'Save redirect' } ).click();
	await expect( drawer ).toBeHidden();

	// Fixed 404s leave the to-do list for their own tab.
	await expect( row ).toBeHidden();
	await page.getByRole( 'button', { name: 'Redirected' } ).click();
	await expect( row.getByText( 'Redirected', { exact: true } ) ).toBeVisible();
	await expect( row ).toContainText( '→ /e2e-target/' );

	await row.getByRole( 'button', { name: 'View redirect' } ).click();
	await expect( page.getByRole( 'dialog', { name: 'Edit redirect' } ) ).toBeVisible();
	await expect( page.getByLabel( 'Send visitors to' ) ).toHaveValue( '/e2e-target/' );
	await page.getByRole( 'button', { name: 'Cancel' } ).click();

	// The same old URL again: it would never run, so saving is blocked.
	await page.goto( APP + '#/redirects?new=1&from=' + encodeURIComponent( missingPath ) );
	const fresh = page.getByRole( 'dialog', { name: 'New redirect' } );
	await fresh.getByLabel( 'Send visitors to' ).fill( '/somewhere-else/' );
	await expect( fresh.getByRole( 'link', { name: 'Edit that redirect' } ) ).toBeVisible();
	await expect( fresh.getByRole( 'button', { name: 'Save redirect' } ) ).toBeDisabled();

	await fresh.getByRole( 'link', { name: 'Edit that redirect' } ).click();
	await expect( page.getByRole( 'dialog', { name: 'Edit redirect' } ) ).toBeVisible();
	await expect( page.getByLabel( 'Send visitors to' ) ).toHaveValue( '/e2e-target/' );
} );
