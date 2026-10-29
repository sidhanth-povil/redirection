import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
	useErrorBulkAction,
	useErrorList,
	useGroupDropdown,
	useRedirectCheck,
	useRedirectCreate,
	useRedirectList,
	useRedirectUpdate,
} from 'lib/api/hooks';
import { useMessageStore, useTableStore } from 'stores';
import { getInitialError } from 'lib/log-constants';
import Logs404 from 'page/logs404';

// `stores` resolves to an automock in src/__mocks__; the page needs the real table state.
jest.mock( 'stores', () => jest.requireActual( '../../stores' ) );
jest.mock( 'lib/api/hooks', () => ( {
	useErrorList: jest.fn(),
	useErrorBulkAction: jest.fn(),
	useGroupDropdown: jest.fn(),
	useRedirectCheck: jest.fn(),
	useRedirectCreate: jest.fn(),
	useRedirectList: jest.fn(),
	useRedirectUpdate: jest.fn(),
} ) );
jest.mock( 'page/redirects/search-content', () => ( { searchContent: jest.fn().mockResolvedValue( [] ) } ) );

global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as any;

const rows = [
	{
		id: '/missing',
		url: '/missing',
		count: 12,
		last_seen: '2026-10-21 09:30:00',
		referrer: 'https://news.test/a',
		suggestion: '/missing-page/',
	},
	{ id: '/old', url: '/old', count: 1, last_seen: '2026-10-20 08:00:00', referrer: '' },
];

const bulk = { mutate: jest.fn() };
const create = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null };
const refetch = jest.fn();

const fixed = {
	id: '/request-appointment/',
	url: '/request-appointment/',
	count: 9,
	last_seen: '2026-10-29 04:56:00',
	redirect: { id: 7, target: '/book-an-appointment/', enabled: true },
};
const paused = { id: '/paused', url: '/paused', count: 2, redirect: { id: 8, target: '/elsewhere', enabled: false } };

function setup( items: object[] = rows ) {
	window.Redirectioni10n = {
		caps: {
			capabilities: [ 'redirection_cap_redirect_add', 'redirection_cap_404_delete' ],
			pages: [ '404s' ],
		},
	} as any;
	( useErrorList as jest.Mock ).mockReturnValue( {
		data: { items, total: items.length },
		isFetching: false,
		refetch,
	} );
	( useErrorBulkAction as jest.Mock ).mockReturnValue( bulk );
	( useGroupDropdown as jest.Mock ).mockReturnValue( { data: { items: [ { id: 1, name: 'Redirections' } ] } } );
	( useRedirectCheck as jest.Mock ).mockReturnValue( { data: undefined } );
	( useRedirectCreate as jest.Mock ).mockReturnValue( create );
	( useRedirectUpdate as jest.Mock ).mockReturnValue( { mutate: jest.fn(), isPending: false, error: null } );

	return render( <Logs404 /> );
}

function row( url: string ): HTMLElement {
	return screen.getByText( url ).closest( 'tr' ) as HTMLElement;
}

beforeEach( () => {
	jest.clearAllMocks();
	window.location.hash = '#/404s';
	useTableStore.getState().setErrorsTable( getInitialError() as any );
} );

describe( '404s page', () => {
	it( 'starts on new 404s this week, grouped by URL', () => {
		setup();

		expect( useErrorList ).toHaveBeenLastCalledWith(
			expect.objectContaining( { groupBy: 'url', filterBy: { since: '7', ignored: '0', redirected: '0' } } )
		);
		expect( screen.getByRole( 'button', { name: 'New this week' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
	} );

	it( 'shows hits, last seen and the top referrer', () => {
		setup();

		const first = row( '/missing' );
		expect( first ).toHaveTextContent( '12' );
		expect( first ).toHaveTextContent( '2026-10-21 09:30' );
		expect( first ).toHaveTextContent( 'from https://news.test/a' );
	} );

	it( 'switches the list with the chips', () => {
		setup();

		fireEvent.click( screen.getByRole( 'button', { name: 'Ignored' } ) );
		expect( useTableStore.getState().errors.filterBy ).toEqual( { ignored: '1' } );

		fireEvent.click( screen.getByRole( 'button', { name: 'All' } ) );
		expect( useTableStore.getState().errors.filterBy ).toEqual( { ignored: '0', redirected: '0' } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Redirected' } ) );
		expect( useTableStore.getState().errors.filterBy ).toEqual( { redirected: '1' } );
	} );

	it( 'marks a fixed 404 with where it now goes', () => {
		setup( [ fixed ] );

		const fixedRow = row( '/request-appointment/' );
		expect( within( fixedRow ).getByText( 'Redirected' ) ).toBeInTheDocument();
		expect( fixedRow ).toHaveTextContent( '→ /book-an-appointment/' );
		expect( within( fixedRow ).queryByRole( 'button', { name: 'Fix' } ) ).toBeNull();
		expect( within( fixedRow ).queryByRole( 'button', { name: 'Ignore' } ) ).toBeNull();
	} );

	it( 'says when the redirect for a 404 is switched off', () => {
		setup( [ paused ] );

		expect( within( row( '/paused' ) ).getByText( 'Redirect off' ) ).toBeInTheDocument();
	} );

	it( 'says once when the redirect behind a fixed 404 has gone', () => {
		( useRedirectList as jest.Mock ).mockReturnValue( { data: undefined, isFetching: false, isError: true } );
		const addError = jest.spyOn( useMessageStore.getState(), 'addError' );
		setup( [ fixed ] );

		fireEvent.click( within( row( '/request-appointment/' ) ).getByRole( 'button', { name: 'View redirect' } ) );

		expect( addError ).toHaveBeenCalledTimes( 1 );
		expect( screen.queryByRole( 'dialog' ) ).toBeNull();
	} );

	it( 'opens the existing redirect instead of a new one', () => {
		( useRedirectList as jest.Mock ).mockReturnValue( {
			data: {
				items: [
					{
						id: 7,
						url: '/request-appointment/',
						match_type: 'url',
						action_type: 'url',
						action_code: 301,
						action_data: { url: '/book-an-appointment/' },
						group_id: 1,
						regex: false,
						enabled: true,
						position: 0,
						match_data: { source: { flag_query: 'exact' } },
					},
				],
				total: 1,
			},
			isFetching: false,
			isError: false,
		} );
		setup( [ fixed ] );

		fireEvent.click( within( row( '/request-appointment/' ) ).getByRole( 'button', { name: 'View redirect' } ) );

		expect( useRedirectList ).toHaveBeenLastCalledWith( expect.objectContaining( { filterBy: { id: '7' } } ) );
		expect( screen.getByRole( 'dialog', { name: 'Edit redirect' } ) ).toBeInTheDocument();
		expect( screen.getByLabelText( 'Send visitors to' ) ).toHaveValue( '/book-an-appointment/' );
	} );

	it( 'opens the drawer filled in to fix a 404', () => {
		setup();

		fireEvent.click( within( row( '/missing' ) ).getByRole( 'button', { name: 'Fix' } ) );

		expect( screen.getByRole( 'dialog', { name: 'New redirect' } ) ).toBeInTheDocument();
		expect( screen.getByLabelText( 'Old URL' ) ).toHaveValue( '/missing' );
	} );

	it( 'shows the suggested page and fills it in when fixing', () => {
		setup();

		expect( row( '/missing' ) ).toHaveTextContent( 'Suggested: /missing-page/' );
		expect( row( '/old' ) ).not.toHaveTextContent( 'Suggested' );

		fireEvent.click( within( row( '/missing' ) ).getByRole( 'button', { name: 'Fix' } ) );

		expect( screen.getByLabelText( 'Send visitors to' ) ).toHaveValue( '/missing-page/' );
	} );

	it( 'leaves the target empty when there is no suggestion', () => {
		setup();

		fireEvent.click( within( row( '/old' ) ).getByRole( 'button', { name: 'Fix' } ) );

		expect( screen.getByLabelText( 'Send visitors to' ) ).toHaveValue( '' );
	} );

	it( 'ignores a 404 with a do-nothing redirect', () => {
		setup();

		fireEvent.click( within( row( '/old' ) ).getByRole( 'button', { name: 'Ignore' } ) );

		expect( create.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { url: '/old', match_type: 'url', action_type: 'nothing', group_id: 1 } ),
			expect.anything()
		);
	} );

	it( 'asks before deleting a URL’s 404s', () => {
		setup();
		window.confirm = jest.fn().mockReturnValue( true );

		fireEvent.click( within( row( '/old' ) ).getByRole( 'button', { name: 'Delete' } ) );

		expect( window.confirm ).toHaveBeenCalled();
		expect( bulk.mutate ).toHaveBeenCalledWith(
			{ action: 'delete', items: [ '/old' ], params: { groupBy: 'url' } },
			expect.anything()
		);
	} );

	it( 'waits for the groups before offering Ignore', () => {
		setup();
		( useGroupDropdown as jest.Mock ).mockReturnValue( { data: undefined } );
		const { container } = render( <Logs404 /> );

		const buttons = container.querySelectorAll( 'button' );
		const ignore = [ ...buttons ].find( ( button ) => button.textContent === 'Ignore' );
		expect( ignore ).toBeDisabled();
	} );

	it( 'steps back a page when deleting the last row of the last page', () => {
		useTableStore.getState().setErrorsTable( { page: 2 } as any );
		( useErrorList as jest.Mock ).mockReturnValue( {
			data: { items: [ rows[ 1 ] ], total: 51 },
			isFetching: false,
			refetch,
		} );
		( useErrorBulkAction as jest.Mock ).mockReturnValue( bulk );
		( useGroupDropdown as jest.Mock ).mockReturnValue( { data: { items: [ { id: 1, name: 'Redirections' } ] } } );
		( useRedirectCreate as jest.Mock ).mockReturnValue( create );
		window.confirm = jest.fn().mockReturnValue( true );
		bulk.mutate.mockImplementation( ( _vars, options ) => options?.onSuccess?.() );
		render( <Logs404 /> );

		fireEvent.click( within( row( '/old' ) ).getByRole( 'button', { name: 'Delete' } ) );

		expect( useTableStore.getState().errors.page ).toBe( 1 );
	} );
} );
