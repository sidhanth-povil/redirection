import apiFetch from '@wp-plugin-lib/api-fetch';
import { getApiRequest } from '@wp-plugin-lib/api-fetch/api-method';
import type { ComboboxOptionItem } from 'ui';

interface SearchResult {
	id: number;
	title: string;
	url: string;
	subtype: string;
}

const RESULT_LIMIT = 8;

function toPath( url: string ): string {
	try {
		const parsed = new URL( url );

		return parsed.pathname + parsed.search;
	} catch {
		return url;
	}
}

// Core search returns rendered titles ("Don&#8217;t"); DOMParser decodes without running markup.
function decodeEntities( text: string ): string {
	return new DOMParser().parseFromString( text, 'text/html' ).documentElement.textContent ?? text;
}

/**
 * Posts, pages and public CPTs by title via core REST `/wp/v2/search`.
 * Picking a result fills in its path, so the link survives a domain move.
 *
 * @param query Text typed by the user.
 */
export async function searchContent( query: string ): Promise< ComboboxOptionItem[] > {
	const results = ( await apiFetch(
		getApiRequest( 'wp/v2/search', { search: query, type: 'post', per_page: RESULT_LIMIT } )
	) ) as SearchResult[];

	return results.map( ( result ) => {
		const path = toPath( result.url );

		return {
			value: path,
			label: decodeEntities( result.title ) || path,
			detail: `${ result.subtype } · ${ path }`,
		};
	} );
}
