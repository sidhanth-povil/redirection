import { act, renderHook } from '@testing-library/react';
import {
	allowedRoutes,
	buildHash,
	legacyUrlToHashUrl,
	pageForRoute,
	parseHash,
	resolveRoute,
	routeForPage,
	useRoute,
} from 'app/router';

const ADMIN = 'http://example.test/wp-admin/admin.php';

describe( 'parseHash', () => {
	it( 'falls back to the default route for an empty or unknown hash', () => {
		expect( parseHash( '' ) ).toEqual( { name: 'redirects', query: {} } );
		expect( parseHash( '#/nope?x=1' ) ).toEqual( { name: 'redirects', query: {} } );
	} );

	it( 'reads the route and its query', () => {
		expect( parseHash( '#/redirects?new=1&from=%2Fx' ) ).toEqual( {
			name: 'redirects',
			query: { new: '1', from: '/x' },
		} );
		expect( parseHash( '#/404s?filterby%5Bip%5D=1.2.3.4' ) ).toEqual( {
			name: '404s',
			query: { 'filterby[ip]': '1.2.3.4' },
		} );
		expect( parseHash( '#/import-export' ) ).toEqual( { name: 'import-export', query: {} } );
	} );
} );

describe( 'buildHash', () => {
	it( 'round-trips through parseHash', () => {
		const hash = buildHash( 'logs', { orderby: 'ip', 'filterby[url]': '/a b' } );

		expect( hash.startsWith( '#/logs?' ) ).toBe( true );
		expect( parseHash( hash ) ).toEqual( { name: 'logs', query: { orderby: 'ip', 'filterby[url]': '/a b' } } );
	} );

	it( 'omits an empty query', () => {
		expect( buildHash( 'settings' ) ).toBe( '#/settings' );
	} );
} );

describe( 'page mapping', () => {
	it( 'maps routes to upstream page names and back', () => {
		expect( pageForRoute( 'redirects' ) ).toBe( 'redirect' );
		expect( pageForRoute( 'logs' ) ).toBe( 'log' );
		expect( pageForRoute( 'settings' ) ).toBe( 'options' );
		expect( routeForPage( 'export' ) ).toBe( 'import-export' );
		expect( routeForPage( 'import' ) ).toBe( 'import-export' );
		expect( routeForPage( 'unknown' ) ).toBe( 'redirects' );
	} );
} );

describe( 'access', () => {
	it( 'keeps only routes the user can see, in sidebar order', () => {
		expect( allowedRoutes( [ 'support', '404s', 'export' ] ) ).toEqual( [ '404s', 'import-export', 'support' ] );
	} );

	it( 'falls back to the first allowed route', () => {
		expect( resolveRoute( 'logs', [ '404s', 'logs' ] ) ).toBe( 'logs' );
		expect( resolveRoute( 'redirects', [ '404s', 'logs' ] ) ).toBe( '404s' );
		expect( resolveRoute( 'redirects', [] ) ).toBeNull();
	} );
} );

describe( 'legacyUrlToHashUrl', () => {
	it( 'rewrites sub pages and keeps their filters', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=404s&filterby%5Bip%5D=1.2.3.4' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/404s?filterby%5Bip%5D=1.2.3.4'
		);
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=options' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/settings'
		);
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=log' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/logs'
		);
	} );

	it( 'treats filters without a sub as the redirects page', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&filterby%5Bgroup%5D=3' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/redirects?filterby%5Bgroup%5D=3'
		);
	} );

	it( 'leaves plain, already-hashed and server-only URLs alone', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php' ) ).toBeNull();
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=log#/404s' ) ).toBeNull();
	} );

	it( 'ignores server-only subs', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=rss&module=1&token=abc' ) ).toBeNull();
	} );
} );

describe( 'useRoute', () => {
	afterEach( () => {
		window.location.hash = '';
	} );

	it( 'ignores in-page anchors such as WordPress skip links', () => {
		window.location.hash = '#/settings';
		const { result } = renderHook( () => useRoute() );

		act( () => {
			window.location.hash = '#wpbody-content';
			window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );
		} );

		expect( result.current.name ).toBe( 'settings' );

		act( () => {
			window.location.hash = '#/logs';
			window.dispatchEvent( new HashChangeEvent( 'hashchange' ) );
		} );

		expect( result.current.name ).toBe( 'logs' );
	} );
} );
