import { renderHook } from '@testing-library/react';
import { useTableUrlSync } from 'lib/hooks/use-table-url-sync';
import type { TableState } from 'types';

window.Redirectioni10n = { per_page: '25' } as any;

const base: TableState = {
	page: 0,
	per_page: 25,
	orderby: '',
	direction: 'desc',
	selected: [],
	filterBy: {},
	groupBy: '',
};

describe( 'useTableUrlSync', () => {
	afterEach( () => {
		window.location.hash = '';
	} );

	it( 'writes table filters into the hash without touching the search string', () => {
		window.location.hash = '#/404s';
		const before = window.location.search;
		const setTable = jest.fn();

		const { rerender } = renderHook(
			( table: TableState ) => useTableUrlSync( { table, setTable, pageName: '404s' } ),
			{
				initialProps: base,
			}
		);

		rerender( { ...base, filterBy: { ip: '1.2.3.4' }, page: 2 } );

		expect( window.location.hash ).toBe( '#/404s?offset=2&filterby%5Bip%5D=1.2.3.4' );
		expect( window.location.search ).toBe( before );
	} );

	it( 'reads filters from the hash on mount', () => {
		window.location.hash = '#/logs?filterby%5Bip%5D=9.9.9.9&orderby=ip';
		const setTable = jest.fn();

		renderHook( () =>
			useTableUrlSync( {
				table: base,
				setTable,
				pageName: 'log',
				allowedOrder: [ 'ip' ],
				allowedFilters: [ 'ip' ],
			} )
		);

		expect( setTable ).toHaveBeenCalledWith( { orderby: 'ip', filterBy: { ip: '9.9.9.9' } } );
	} );
} );
