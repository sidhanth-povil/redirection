import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
	useExport,
	useGroupDropdown,
	useRedirectBulkAction,
	useRedirectCheck,
	useRedirectCreate,
	useRedirectDelete,
	useRedirectList,
	useRedirectTest,
	useRedirectUpdate,
} from 'lib/api/hooks';
import { useTableStore } from 'stores';
import Redirects from 'page/redirects';

// `stores` resolves to an automock in src/__mocks__; the page needs the real table state.
jest.mock( 'stores', () => jest.requireActual( '../../stores' ) );
jest.mock( 'lib/api/hooks', () => ( {
	useRedirectList: jest.fn(),
	useGroupDropdown: jest.fn(),
	useRedirectDelete: jest.fn(),
	useRedirectBulkAction: jest.fn(),
	useRedirectCheck: jest.fn(),
	useExport: jest.fn(),
	useRedirectCreate: jest.fn(),
	useRedirectUpdate: jest.fn(),
	useRedirectTest: jest.fn(),
} ) );
jest.mock( 'page/redirects/search-content', () => ( { searchContent: jest.fn().mockResolvedValue( [] ) } ) );

global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as any;

const ALL_CAPS = [
	'redirection_cap_redirect_add',
	'redirection_cap_redirect_delete',
	'redirection_cap_redirect_manage',
];

const rows = [
	{
		id: 1,
		url: '/old-sale',
		match_type: 'url',
		action_type: 'url',
		action_code: 301,
		action_data: { url: '/autumn-sale/' },
		group_id: 1,
		title: '',
		position: 0,
		enabled: true,
		hits: 12,
		last_access: 'October 20, 2026',
	},
	{
		id: 2,
		url: '/discontinued',
		match_type: 'url',
		action_type: 'error',
		action_code: 410,
		action_data: {},
		group_id: 1,
		title: '',
		position: 0,
		enabled: false,
		hits: 0,
		last_access: '-',
	},
	{
		id: 3,
		url: '/black-friday',
		match_type: 'url',
		action_type: 'url',
		action_code: 302,
		action_data: { url: '/sale' },
		group_id: 1,
		title: '',
		position: 0,
		enabled: true,
		hits: 0,
		last_access: '-',
		start_at: '2026-11-28T00:00:00+05:30',
		end_at: null,
		schedule_state: 'scheduled',
	},
	{
		id: 4,
		url: '/blog/*',
		match_type: 'url',
		action_type: 'url',
		action_code: 301,
		action_data: { url: '/news/*' },
		match_data: {
			source: {
				flag_regex: false,
				flag_case: false,
				flag_trailing: false,
				flag_query: 'exact',
				flag_wildcard: true,
			},
		},
		group_id: 1,
		title: '',
		position: 0,
		enabled: true,
		hits: 0,
		last_access: '-',
	},
];

const remove = { mutate: jest.fn() };
const bulk = { mutate: jest.fn() };

function setup( caps = ALL_CAPS ) {
	window.Redirectioni10n = { per_page: '25', caps: { capabilities: caps, pages: [ 'redirect' ] } } as any;
	( useRedirectList as jest.Mock ).mockReturnValue( { data: { items: rows, total: 4 }, isLoading: false } );
	( useGroupDropdown as jest.Mock ).mockReturnValue( { data: { items: [ { id: 1, name: 'Redirections' } ] } } );
	( useRedirectDelete as jest.Mock ).mockReturnValue( remove );
	( useRedirectBulkAction as jest.Mock ).mockReturnValue( bulk );
	( useExport as jest.Mock ).mockReturnValue( { mutate: jest.fn() } );
	( useRedirectCreate as jest.Mock ).mockReturnValue( { mutate: jest.fn(), isPending: false, error: null } );
	( useRedirectUpdate as jest.Mock ).mockReturnValue( { mutate: jest.fn(), isPending: false, error: null } );
	( useRedirectCheck as jest.Mock ).mockReturnValue( { data: undefined } );

	return render( <Redirects /> );
}

beforeEach( () => {
	jest.clearAllMocks();
	// Here rather than in setup() so a test can replace it before rendering.
	( useRedirectTest as jest.Mock ).mockReturnValue( { mutate: jest.fn(), isPending: false } );
	window.location.hash = '#/redirects';
	useTableStore.getState().setRedirectsTable( { filterBy: {}, selected: [], page: 0 } );
} );

describe( 'Redirects page', () => {
	it( 'lists redirects with source, destination and plain type', () => {
		setup();

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		expect( within( first ).getByText( '→ /autumn-sale/' ) ).toBeInTheDocument();
		expect( within( first ).getByText( 'Permanent' ) ).toBeInTheDocument();

		const second = screen.getByText( '/discontinued' ).closest( 'tr' ) as HTMLElement;
		expect( within( second ).getByText( 'Gone' ) ).toBeInTheDocument();
		expect( within( second ).getByText( 'Disabled' ) ).toBeInTheDocument();
		expect( within( second ).getByRole( 'button', { name: 'Enable' } ) ).toBeInTheDocument();
	} );

	it( 'filters by status with the chips', () => {
		setup();

		fireEvent.click( screen.getByRole( 'button', { name: 'Disabled' } ) );

		expect( useTableStore.getState().redirects.filterBy ).toEqual( { status: 'disabled' } );
		expect( screen.getByRole( 'button', { name: 'Disabled' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
	} );

	it( 'opens the drawer to edit a row', () => {
		setup();

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		fireEvent.click( within( first ).getByRole( 'button', { name: 'Edit' } ) );

		const dialog = screen.getByRole( 'dialog', { name: 'Edit redirect' } );
		expect( within( dialog ).getByLabelText( 'Old URL' ) ).toHaveValue( '/old-sale' );
	} );

	it( 'bulk deletes the selected rows after confirming', () => {
		const confirm = jest.spyOn( window, 'confirm' ).mockReturnValue( true );
		setup();

		fireEvent.click( screen.getByRole( 'checkbox', { name: 'Select /old-sale' } ) );
		const bar = screen.getByRole( 'region', { name: 'Bulk actions' } );
		expect( bar ).toHaveTextContent( '1 selected' );

		fireEvent.click( within( bar ).getByRole( 'button', { name: 'Delete' } ) );

		expect( confirm ).toHaveBeenCalled();
		expect( remove.mutate ).toHaveBeenCalledWith( { items: [ 1 ] } );
		confirm.mockRestore();
	} );

	it( 'opens a prefilled new redirect from the deep link', () => {
		window.location.hash = '#/redirects?new=1&from=%2Fmissing-page';
		setup();

		const dialog = screen.getByRole( 'dialog', { name: 'New redirect' } );
		expect( within( dialog ).getByLabelText( 'Old URL' ) ).toHaveValue( '/missing-page' );
		expect( window.location.hash ).toBe( '#/redirects' );
	} );

	it( 'opens a temporary redirect to the page from the admin bar link', () => {
		window.location.hash = '#/redirects?new=1&to=%2Fsummer-landing%2F';
		setup();

		const dialog = screen.getByRole( 'dialog', { name: 'New redirect' } );
		expect( within( dialog ).getByLabelText( 'Old URL' ) ).toHaveValue( '' );
		expect( within( dialog ).getByLabelText( 'Send visitors to' ) ).toHaveValue( '/summer-landing/' );
		expect( within( dialog ).getByRole( 'radio', { name: /Temporary/ } ) ).toBeChecked();
	} );

	it( 'copies the full short link for a row', async () => {
		const writeText = jest.fn().mockResolvedValue( undefined );
		Object.defineProperty( navigator, 'clipboard', { value: { writeText }, configurable: true } );
		setup();

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		await act( async () => {
			fireEvent.click( within( first ).getByRole( 'button', { name: 'Copy link' } ) );
		} );

		expect( writeText ).toHaveBeenCalledWith( `${ window.location.origin }/old-sale` );
		expect( within( first ).getByRole( 'button', { name: 'Copied' } ) ).toBeInTheDocument();
	} );

	it( 'tests a redirect from the server and shows where it went', () => {
		const mutate = jest.fn( ( _id, { onSuccess } ) =>
			onSuccess( {
				code: 302,
				location: '/autumn-sale/?utm_source=dsr-test',
				ms: 14,
				utm_preserved: true,
				ok: true,
			} )
		);
		( useRedirectTest as jest.Mock ).mockReturnValue( { mutate, isPending: false } );
		setup();

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		fireEvent.click( within( first ).getByRole( 'button', { name: 'Test' } ) );

		expect( mutate ).toHaveBeenCalledWith( 1, expect.anything() );
		expect( within( first ).getByRole( 'status' ) ).toHaveTextContent(
			'✓ 302 → /autumn-sale/?utm_source=dsr-test · 14 ms · tracking kept'
		);
	} );

	it( 'says when a tested redirect did not go where expected', () => {
		const mutate = jest.fn( ( _id, { onSuccess } ) =>
			onSuccess( { code: 404, location: '', ms: 9, utm_preserved: null, ok: false } )
		);
		( useRedirectTest as jest.Mock ).mockReturnValue( { mutate, isPending: false } );
		setup();

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		fireEvent.click( within( first ).getByRole( 'button', { name: 'Test' } ) );

		expect( within( first ).getByRole( 'status' ) ).toHaveTextContent( '✕ Got 404 · 9 ms' );
	} );

	it( 'shows why a test could not run', () => {
		const mutate = jest.fn( ( _id, { onError } ) => onError( new Error( 'Your site could not reach itself' ) ) );
		( useRedirectTest as jest.Mock ).mockReturnValue( { mutate, isPending: false } );
		setup();

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		fireEvent.click( within( first ).getByRole( 'button', { name: 'Test' } ) );

		expect( within( first ).getByRole( 'status' ) ).toHaveTextContent( 'Your site could not reach itself' );
	} );

	it( 'offers no test for a wildcard redirect', () => {
		setup();

		const wildcard = screen.getByText( '/blog/*' ).closest( 'tr' ) as HTMLElement;
		expect( within( wildcard ).queryByRole( 'button', { name: 'Test' } ) ).toBeNull();
	} );

	it( 'hides actions the user cannot perform', () => {
		setup( [ 'redirection_cap_redirect_manage' ] );

		const first = screen.getByText( '/old-sale' ).closest( 'tr' ) as HTMLElement;
		expect( within( first ).queryByRole( 'button', { name: 'Edit' } ) ).toBeNull();
		expect( within( first ).queryByRole( 'button', { name: 'Disable' } ) ).toBeNull();
		expect( within( first ).queryByRole( 'button', { name: 'Delete' } ) ).toBeNull();
	} );

	it( 'shows when a scheduled redirect starts', () => {
		setup();

		const row = screen.getByText( '/black-friday' ).closest( 'tr' ) as HTMLElement;
		expect( within( row ).getByText( 'Starts Nov 28' ) ).toBeInTheDocument();
	} );

	it( 'filters by schedule with the chips', () => {
		setup();

		fireEvent.click( screen.getByRole( 'button', { name: 'Scheduled' } ) );
		expect( useTableStore.getState().redirects.filterBy ).toEqual( { schedule: 'scheduled' } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Live' } ) );
		expect( useTableStore.getState().redirects.filterBy ).toEqual( { status: 'enabled', schedule: 'live' } );
		expect( screen.getByRole( 'button', { name: 'Live' } ) ).toHaveAttribute( 'aria-pressed', 'true' );

		fireEvent.click( screen.getByRole( 'button', { name: 'Expired' } ) );
		expect( useTableStore.getState().redirects.filterBy ).toEqual( { schedule: 'expired' } );

		fireEvent.click( screen.getByRole( 'button', { name: 'All' } ) );
		expect( useTableStore.getState().redirects.filterBy ).toEqual( {} );
	} );

	it( 'marks wildcard redirects', () => {
		setup();

		const row = screen.getByText( '/blog/*' ).closest( 'tr' ) as HTMLElement;
		expect( within( row ).getByText( 'Wildcard' ) ).toBeInTheDocument();
	} );

	it( 'shows the unused filter from Overview and clears it', () => {
		useTableStore.getState().setRedirectsTable( { filterBy: { access: 'year' } } );
		setup();

		fireEvent.click( screen.getByRole( 'button', { name: /No hits in a year/ } ) );

		expect( useTableStore.getState().redirects.filterBy ).toEqual( {} );
	} );
} );
