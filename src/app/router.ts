import { __ } from '@wordpress/i18n';
import { useMemo, useSyncExternalStore } from 'react';

export type RouteName = 'redirects' | 'groups' | '404s' | 'logs' | 'site' | 'import-export' | 'settings' | 'support';

export interface Route {
	name: RouteName;
	query: Record< string, string >;
}

interface RouteDef {
	name: RouteName;
	/** Upstream page names covered by this route: used for capabilities and old `sub=` links. */
	pages: string[];
}

/** Sidebar order. */
export const ROUTES: RouteDef[] = [
	{ name: 'redirects', pages: [ 'redirect' ] },
	{ name: 'groups', pages: [ 'groups' ] },
	{ name: '404s', pages: [ '404s' ] },
	{ name: 'logs', pages: [ 'log' ] },
	{ name: 'site', pages: [ 'site' ] },
	{ name: 'import-export', pages: [ 'import', 'export' ] },
	{ name: 'settings', pages: [ 'options' ] },
	{ name: 'support', pages: [ 'support' ] },
];

export const DEFAULT_ROUTE: RouteName = 'redirects';

export function getRouteLabel( name: RouteName ): string {
	switch ( name ) {
		case 'redirects':
			return __( 'Redirects', 'dsuite-redirects' );
		case 'groups':
			return __( 'Groups', 'dsuite-redirects' );
		case '404s':
			return __( '404s', 'dsuite-redirects' );
		case 'logs':
			return __( 'Logs', 'dsuite-redirects' );
		case 'site':
			return __( 'Site & domain', 'dsuite-redirects' );
		case 'import-export':
			return __( 'Import / Export', 'dsuite-redirects' );
		case 'settings':
			return __( 'Settings', 'dsuite-redirects' );
		case 'support':
			return __( 'Support', 'dsuite-redirects' );
	}
}

// tsconfig has no `dom.iterable`, so URLSearchParams can't be spread or passed to Object.fromEntries.
export function toQuery( params: URLSearchParams ): Record< string, string > {
	const query: Record< string, string > = {};

	params.forEach( ( value, key ) => {
		query[ key ] = value;
	} );

	return query;
}

function findRoute( name: string ): RouteDef | undefined {
	return ROUTES.find( ( route ) => route.name === name );
}

export function parseHash( hash: string ): Route {
	const body = hash.replace( /^#\/?/, '' );
	const split = body.indexOf( '?' );
	const path = split === -1 ? body : body.slice( 0, split );
	const route = findRoute( path );

	if ( ! route ) {
		return { name: DEFAULT_ROUTE, query: {} };
	}

	const search = split === -1 ? '' : body.slice( split + 1 );

	return { name: route.name, query: toQuery( new URLSearchParams( search ) ) };
}

export function buildHash( name: RouteName, query: Record< string, string > = {} ): string {
	const search = new URLSearchParams( query ).toString();

	return '#/' + name + ( search === '' ? '' : '?' + search );
}

export function pageForRoute( name: RouteName ): string {
	return findRoute( name )?.pages[ 0 ] ?? 'redirect';
}

export function routeForPage( page: string ): RouteName {
	return ROUTES.find( ( route ) => route.pages.includes( page ) )?.name ?? DEFAULT_ROUTE;
}

export function allowedRoutes( allowedPages: string[] ): RouteName[] {
	return ROUTES.filter( ( route ) => route.pages.some( ( page ) => allowedPages.includes( page ) ) ).map(
		( route ) => route.name
	);
}

export function resolveRoute( name: RouteName, allowed: RouteName[] ): RouteName | null {
	return allowed.includes( name ) ? name : allowed[ 0 ] ?? null;
}

/**
 * Old `?page=…&sub=404s&filterby[…]=…` links (PHP notices, plugin list links, bookmarks, the Tools redirect)
 * become `?page=…#/404s?filterby[…]=…`. Subs with no route (rss, downloads) are left for PHP.
 *
 * @param href Current location.
 */
export function legacyUrlToHashUrl( href: string ): string | null {
	const url = new URL( href );

	if ( url.hash !== '' ) {
		return null;
	}

	const params = new URLSearchParams( url.search );
	const page = params.get( 'page' ) ?? '';
	const sub = params.get( 'sub' );

	params.delete( 'page' );
	params.delete( 'sub' );

	let name: RouteName | null = null;

	if ( sub !== null ) {
		name = ROUTES.find( ( route ) => route.pages.includes( sub ) )?.name ?? null;
	} else if ( params.toString() !== '' ) {
		name = DEFAULT_ROUTE;
	}

	if ( name === null ) {
		return null;
	}

	return url.pathname + '?page=' + encodeURIComponent( page ) + buildHash( name, toQuery( params ) );
}

function subscribe( onChange: () => void ): () => void {
	window.addEventListener( 'hashchange', onChange );

	return () => window.removeEventListener( 'hashchange', onChange );
}

let lastRouteHash = '';

/**
 * Only `#/…` hashes are routes. In-page anchors such as WordPress's "Skip to main content"
 * (`#wpbody-content`) keep the current route instead of falling back to the default page.
 */
function getRouteHash(): string {
	const hash = window.location.hash;

	if ( hash === '' || hash.startsWith( '#/' ) ) {
		lastRouteHash = hash;
	}

	return lastRouteHash;
}

export function useRoute(): Route {
	const hash = useSyncExternalStore( subscribe, getRouteHash );

	return useMemo( () => parseHash( hash ), [ hash ] );
}
