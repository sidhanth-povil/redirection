import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useGroupDropdown, useHealth, useRedirectCheck, useRedirectCreate, useRedirectUpdate } from 'lib/api/hooks';
import Overview from 'page/overview';

// `stores` resolves to an automock in src/__mocks__; the drawer needs the real settings state.
jest.mock( 'stores', () => jest.requireActual( '../../stores' ) );
jest.mock( 'lib/api/hooks', () => ( {
	useHealth: jest.fn(),
	useGroupDropdown: jest.fn(),
	useRedirectCheck: jest.fn(),
	useRedirectCreate: jest.fn(),
	useRedirectUpdate: jest.fn(),
} ) );
jest.mock( 'page/redirects/search-content', () => ( { searchContent: jest.fn().mockResolvedValue( [] ) } ) );

global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as any;

const redirect = ( id: number, url: string, target: string ) => ( {
	id,
	url,
	match_type: 'url',
	action_type: 'url',
	action_code: 301,
	action_data: { url: target },
	match_data: {
		source: { flag_regex: false, flag_trailing: false, flag_case: false, flag_query: 'exact' },
		options: {},
	},
	group_id: 1,
	title: '',
	position: 0,
	enabled: true,
	hits: 3,
} );

const counts = { active: 12, new404s: 4, chains: 1, loops: 2, scheduled: 1 };

const attention = [
	{ type: 'loop', id: 7, hits: 9, path: [ '/a', '/b', '/a' ], redirect: redirect( 7, '/a', '/b' ) },
	{ type: '404', url: '/missing-page', hits: 30 },
	{
		type: 'chain',
		id: 5,
		hits: 3,
		path: [ '/old', '/middle', '/new' ],
		final_target: '/new',
		redirect: redirect( 5, '/old', '/middle' ),
	},
	{
		type: 'expiring',
		id: 6,
		hits: 1,
		end_at: '2026-10-25T10:00:00+00:00',
		redirect: { ...redirect( 6, '/promo', '/sale' ), end_at: '2026-10-25T10:00:00+00:00' },
	},
];

const update = { mutate: jest.fn(), isPending: false, error: null };
const refetch = jest.fn();

function setup( data: any = { counts, attention } ) {
	window.Redirectioni10n = {
		caps: { capabilities: [ 'redirection_cap_redirect_add' ], pages: [ 'redirect' ] },
	} as any;
	( useHealth as jest.Mock ).mockReturnValue( { data, isLoading: false, refetch } );
	( useGroupDropdown as jest.Mock ).mockReturnValue( { data: { items: [ { id: 1, name: 'Redirections' } ] } } );
	( useRedirectCheck as jest.Mock ).mockReturnValue( { data: undefined } );
	( useRedirectCreate as jest.Mock ).mockReturnValue( { mutate: jest.fn(), isPending: false, error: null } );
	( useRedirectUpdate as jest.Mock ).mockReturnValue( update );

	return render( <Overview /> );
}

function row( text: string ): HTMLElement {
	return screen.getByText( text ).closest( 'li' ) as HTMLElement;
}

beforeEach( () => jest.clearAllMocks() );

describe( 'Overview', () => {
	it( 'shows the KPI tiles', () => {
		setup();

		const tiles = screen.getByRole( 'list', { name: 'Summary' } );
		expect( within( tiles ).getByText( 'Active redirects' ).closest( 'li' ) ).toHaveTextContent( '12' );
		expect( within( tiles ).getByText( 'New 404s (7 days)' ).closest( 'li' ) ).toHaveTextContent( '4' );
		expect( within( tiles ).getByText( 'Chains & loops' ).closest( 'li' ) ).toHaveTextContent( '3' );
		expect( within( tiles ).getByText( 'Scheduled (7 days)' ).closest( 'li' ) ).toHaveTextContent( '1' );
	} );

	it( 'says all clear when nothing needs attention', () => {
		setup( { counts: { ...counts, new404s: 0, chains: 0, loops: 0 }, attention: [] } );

		expect( screen.getByText( 'All clear. Nothing needs attention.' ) ).toBeInTheDocument();
	} );

	it( 'opens the drawer filled in when fixing a 404', () => {
		setup();

		fireEvent.click( within( row( '/missing-page' ) ).getByRole( 'button', { name: 'Fix' } ) );

		expect( screen.getByRole( 'dialog', { name: 'New redirect' } ) ).toBeInTheDocument();
		expect( screen.getByLabelText( 'Old URL' ) ).toHaveValue( '/missing-page' );
	} );

	it( 'flattens a chain by saving its final target', () => {
		setup();

		fireEvent.click( within( row( '/old → /middle → /new' ) ).getByRole( 'button', { name: 'Flatten' } ) );

		expect( update.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 5, url: '/old', action_data: { url: '/new' } } ),
			expect.anything()
		);
	} );

	it( 'offers no Flatten for a loop, only Edit', () => {
		setup();

		const loop = row( '/a → /b → /a' );
		expect( within( loop ).queryByRole( 'button', { name: 'Flatten' } ) ).toBeNull();

		fireEvent.click( within( loop ).getByRole( 'button', { name: 'Edit' } ) );
		expect( screen.getByRole( 'dialog', { name: 'Edit redirect' } ) ).toBeInTheDocument();
	} );

	it( 'opens an ending redirect on its dates to extend it', () => {
		setup();

		fireEvent.click( within( row( '/promo' ) ).getByRole( 'button', { name: 'Extend' } ) );

		expect( screen.getByRole( 'dialog', { name: 'Edit redirect' } ) ).toBeInTheDocument();
		expect( screen.getByLabelText( 'Ends' ) ).toBeInTheDocument();
	} );
} );
