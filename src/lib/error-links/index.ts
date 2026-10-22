/* global Redirectioni10n, REDIRECTION_VERSION */

interface ErrorLinks {
	url: string;
	http: string;
	api: string;
	rootUrl: string;
	siteHealth: string;
}

export function getErrorLinks(): ErrorLinks {
	// WordPress's own docs: the plugin's original help pages lived on the upstream author's site.
	return {
		url: 'https://developer.wordpress.org/advanced-administration/upgrade/migrating/#changing-the-site-url',
		http: 'https://developer.wordpress.org/rest-api/frequently-asked-questions/',
		api: 'https://developer.wordpress.org/rest-api/frequently-asked-questions/',
		rootUrl: Redirectioni10n.api.WP_API_root,
		siteHealth: Redirectioni10n.api.site_health,
	};
}

export function getErrorDetails(): string[] {
	return Redirectioni10n.versions.split( '\n' ).concat( [ 'Query: ' + document.location.search ] );
}

export function getCacheBuster(): string {
	return 'Buster: ' + REDIRECTION_VERSION + ' === ' + Redirectioni10n.version;
}

// Reload the current admin page with a unique query param, to bypass any page/CDN
// caching that's keyed on the URL (browser reload alone won't do this).
export function getReloadUrl(): string {
	const url = new URL( window.location.href );

	url.searchParams.set( 'redirection_cache_bust', Date.now().toString() );

	return url.toString();
}
