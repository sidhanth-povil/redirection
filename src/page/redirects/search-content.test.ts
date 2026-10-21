import apiFetch from '@wp-plugin-lib/api-fetch';
import { getApiRequest } from '@wp-plugin-lib/api-fetch/api-method';
import { searchContent } from './search-content';

describe( 'searchContent', () => {
	it( 'queries core search and maps results to paths', async () => {
		( getApiRequest as jest.Mock ).mockReturnValue( { url: 'request' } );
		( apiFetch as unknown as jest.Mock ).mockResolvedValue( [
			{ id: 7, title: 'Autumn Sale', url: 'http://example.test/autumn-sale/', subtype: 'page' },
			{ id: 8, title: '', url: 'http://example.test/?p=8', subtype: 'post' },
		] );

		const results = await searchContent( 'sale' );

		expect( getApiRequest ).toHaveBeenCalledWith( 'wp/v2/search', { search: 'sale', type: 'post', per_page: 8 } );
		expect( apiFetch ).toHaveBeenCalledWith( { url: 'request' } );
		expect( results ).toEqual( [
			{ value: '/autumn-sale/', label: 'Autumn Sale', detail: 'page · /autumn-sale/' },
			{ value: '/?p=8', label: '/?p=8', detail: 'post · /?p=8' },
		] );
	} );

	it( 'decodes HTML entities in titles', async () => {
		( getApiRequest as jest.Mock ).mockReturnValue( { url: 'request' } );
		( apiFetch as unknown as jest.Mock ).mockResolvedValue( [
			{ id: 9, title: 'Don&#8217;t miss &amp; save', url: 'http://example.test/deal/', subtype: 'page' },
		] );

		const [ result ] = await searchContent( 'deal' );

		expect( result?.label ).toBe( 'Don\u2019t miss & save' );
	} );
} );
