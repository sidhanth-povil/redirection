import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useGroupDropdown, useRedirectCheck, useRedirectCreate, useRedirectUpdate } from 'lib/api/hooks';
import type { Redirect } from 'types';
import RedirectDrawer from './redirect-drawer';

jest.mock( 'lib/api/hooks', () => ( {
	useGroupDropdown: jest.fn(),
	useRedirectCheck: jest.fn(),
	useRedirectCreate: jest.fn(),
	useRedirectUpdate: jest.fn(),
} ) );
jest.mock( './search-content', () => ( { searchContent: jest.fn().mockResolvedValue( [] ) } ) );

global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as any;

const create = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null as Error | null };
const update = {
	mutate: jest.fn(),
	mutateAsync: jest.fn().mockResolvedValue( {} ),
	reset: jest.fn(),
	isPending: false,
	error: null as Error | null,
};

beforeEach( () => {
	jest.clearAllMocks();
	create.error = null;
	( useGroupDropdown as jest.Mock ).mockReturnValue( { data: { items: [ { id: 1, name: 'Redirections' } ] } } );
	( useRedirectCreate as jest.Mock ).mockReturnValue( create );
	( useRedirectUpdate as jest.Mock ).mockReturnValue( update );
	( useRedirectCheck as jest.Mock ).mockReturnValue( { data: undefined, isPlaceholderData: false } );
	window.localStorage.clear();
} );

const redirect307: Redirect = {
	id: 5,
	url: '/promo',
	match_type: 'url',
	action_type: 'url',
	action_code: 307,
	action_data: { url: '/sale' },
	match_data: {
		source: { flag_regex: false, flag_trailing: false, flag_case: false, flag_query: 'exact' },
		options: {},
	},
	group_id: 1,
	title: '',
	position: 0,
};

const inboundRow: Redirect = { ...redirect307, id: 9, url: '/spring', action_data: { url: '/sale' } };

function saveSaleToSummer() {
	( useRedirectCheck as jest.Mock ).mockReturnValue( {
		data: { status: 'ok', inbound: [ inboundRow ] },
		isPlaceholderData: false,
	} );
	const onClose = jest.fn();
	render( <RedirectDrawer item={ null } initialUrl="/sale" initialTarget="/summer" onClose={ onClose } /> );

	return onClose;
}

describe( 'RedirectDrawer', () => {
	it( 'creates a temporary redirect from the simple fields', () => {
		const onClose = jest.fn();
		render( <RedirectDrawer item={ null } initialUrl="/old" onClose={ onClose } /> );

		const dialog = screen.getByRole( 'dialog', { name: 'New redirect' } );
		expect( within( dialog ).getByLabelText( 'Old URL' ) ).toHaveValue( '/old' );

		fireEvent.change( within( dialog ).getByLabelText( 'Send visitors to' ), { target: { value: '/new' } } );
		fireEvent.click( within( dialog ).getByRole( 'radio', { name: /Temporary/ } ) );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );

		expect( create.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( {
				url: '/old',
				action_type: 'url',
				action_code: 302,
				action_data: { url: '/new' },
				group_id: 1,
			} ),
			expect.objectContaining( { onSuccess: onClose } )
		);
	} );

	it( 'repoints redirects that lead here once the new one is saved', async () => {
		const onClose = saveSaleToSummer();

		const repoint = screen.getByRole( 'checkbox', {
			name: /Also point 1 redirect that leads here straight to \/summer/,
		} );
		expect( repoint ).toBeChecked();
		expect( screen.getByText( '/spring' ) ).toBeInTheDocument();

		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );
		create.mutate.mock.calls[ 0 ][ 1 ].onSuccess();

		await waitFor( () => expect( onClose ).toHaveBeenCalled() );
		expect( update.mutateAsync ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 9, url: '/spring', action_data: { url: '/summer' } } )
		);
	} );

	it( 'leaves redirects that lead here alone when asked', async () => {
		const onClose = saveSaleToSummer();

		fireEvent.click( screen.getByRole( 'checkbox', { name: /Also point 1 redirect/ } ) );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );
		create.mutate.mock.calls[ 0 ][ 1 ].onSuccess();

		await waitFor( () => expect( onClose ).toHaveBeenCalled() );
		expect( update.mutateAsync ).not.toHaveBeenCalled();
	} );

	it( 'starts typing in Old URL and files new redirects in the last used group', async () => {
		( useGroupDropdown as jest.Mock ).mockReturnValue( {
			data: {
				items: [
					{ id: 2, name: 'Modified Posts' },
					{ id: 1, name: 'Redirections' },
				],
			},
		} );
		render( <RedirectDrawer item={ null } initialUrl="/old" onClose={ jest.fn() } /> );

		await waitFor( () => expect( screen.getByLabelText( 'Old URL' ) ).toHaveFocus() );
		expect( screen.getByLabelText( 'Group' ) ).toHaveValue( '1' );
	} );

	it( 'disables save until a destination is entered', () => {
		render( <RedirectDrawer item={ null } initialUrl="/old" onClose={ jest.fn() } /> );

		expect( screen.getByRole( 'button', { name: 'Save redirect' } ) ).toBeDisabled();
	} );

	it( 'edit of a 307 shows no plain type and keeps it', () => {
		render( <RedirectDrawer item={ redirect307 } onClose={ jest.fn() } /> );

		expect( screen.getByRole( 'dialog', { name: 'Edit redirect' } ) ).toBeInTheDocument();
		expect( screen.queryByRole( 'radio', { checked: true } ) ).toBeNull();
		expect( screen.getByText( /custom action/i ) ).toBeInTheDocument();
		expect( document.querySelector( 'details.dsr-advanced' ) ).toHaveAttribute( 'open' );

		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );

		expect( update.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 5, action_code: 307, action_data: { url: '/sale' } } ),
			expect.anything()
		);
	} );

	it( 'asks before discarding changes', () => {
		const onClose = jest.fn();
		const confirm = jest.spyOn( window, 'confirm' ).mockReturnValue( false );
		render( <RedirectDrawer item={ null } onClose={ onClose } /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Cancel' } ) );
		expect( confirm ).not.toHaveBeenCalled();
		expect( onClose ).toHaveBeenCalledTimes( 1 );

		fireEvent.change( screen.getByLabelText( 'Old URL' ), { target: { value: '/typed' } } );
		fireEvent.click( screen.getByRole( 'button', { name: 'Cancel' } ) );

		expect( confirm ).toHaveBeenCalled();
		expect( onClose ).toHaveBeenCalledTimes( 1 );
		confirm.mockRestore();
	} );

	it( 'keeps values and shows the error when saving fails', () => {
		create.error = new Error( 'Source URL already exists' );
		render( <RedirectDrawer item={ null } initialUrl="/dup" onClose={ jest.fn() } /> );

		expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Source URL already exists' );
		expect( screen.getByLabelText( 'Old URL' ) ).toHaveValue( '/dup' );
	} );

	it( 'remembers the Advanced section state', () => {
		render( <RedirectDrawer item={ null } onClose={ jest.fn() } /> );

		const details = document.querySelector( 'details.dsr-advanced' ) as HTMLDetailsElement;
		expect( details ).not.toHaveAttribute( 'open' );

		details.open = true;
		fireEvent( details, new Event( 'toggle' ) );

		expect( window.localStorage.getItem( 'dsr_advanced_open' ) ).toBe( '1' );
	} );

	it( 'locks the plain types on conditional redirects', () => {
		const login: Redirect = {
			...redirect307,
			match_type: 'login',
			action_code: 302,
			action_data: { logged_in: '/members', logged_out: '/login' },
		};
		render( <RedirectDrawer item={ login } onClose={ jest.fn() } /> );

		expect( screen.getByRole( 'group', { name: 'Type' } ) ).toBeDisabled();
		fireEvent.click( screen.getByRole( 'radio', { name: /Gone/ } ) );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );

		expect( update.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { match_type: 'login', action_type: 'url', action_code: 302 } ),
			expect.anything()
		);
	} );

	it( 'shows save errors only in the drawer and clears them once the user edits', () => {
		create.error = new Error( 'Source URL already exists' );
		render( <RedirectDrawer item={ null } initialUrl="/dup" onClose={ jest.fn() } /> );

		// The upstream hooks also push errors to the page-wide panel unless onError is overridden.
		expect( useRedirectCreate ).toHaveBeenCalledWith(
			expect.objectContaining( { onError: expect.any( Function ) } )
		);
		expect( useRedirectUpdate ).toHaveBeenCalledWith(
			expect.objectContaining( { onError: expect.any( Function ) } )
		);

		fireEvent.change( screen.getByLabelText( 'Old URL' ), { target: { value: '/dup-2' } } );

		expect( create.reset ).toHaveBeenCalled();
	} );

	it( 'does not remember Advanced as open when it opened itself', () => {
		render( <RedirectDrawer item={ redirect307 } onClose={ jest.fn() } /> );

		const details = document.querySelector( 'details.dsr-advanced' ) as HTMLDetailsElement;
		fireEvent( details, new Event( 'toggle' ) );

		expect( window.localStorage.getItem( 'dsr_advanced_open' ) ).toBeNull();
	} );

	it( 'schedules a redirect between two dates', () => {
		render( <RedirectDrawer item={ null } initialUrl="/sale" onClose={ jest.fn() } /> );

		expect( screen.queryByLabelText( 'Starts' ) ).toBeNull();

		fireEvent.change( screen.getByLabelText( 'Send visitors to' ), { target: { value: '/autumn-sale' } } );
		fireEvent.click( screen.getByRole( 'switch', { name: 'Only active between dates' } ) );
		fireEvent.change( screen.getByLabelText( 'Starts' ), { target: { value: '2026-12-02T09:00' } } );
		fireEvent.change( screen.getByLabelText( 'Ends' ), { target: { value: '2026-11-28T09:00' } } );

		expect( screen.getByText( /must be after the start/ ) ).toBeInTheDocument();
		expect( screen.getByRole( 'button', { name: 'Save redirect' } ) ).toBeDisabled();

		fireEvent.change( screen.getByLabelText( 'Ends' ), { target: { value: '2026-12-09T09:00' } } );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );

		expect( create.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { start_at: '2026-12-02T09:00', end_at: '2026-12-09T09:00' } ),
			expect.anything()
		);
	} );

	it( 'turning the schedule off clears the dates', () => {
		render(
			<RedirectDrawer
				item={ { ...redirect307, action_code: 301, start_at: '2026-11-28T09:00:00+05:30', end_at: null } }
				onClose={ jest.fn() }
			/>
		);

		const toggle = screen.getByRole( 'switch', { name: 'Only active between dates' } );
		expect( toggle ).toBeChecked();
		expect( screen.getByLabelText( 'Starts' ) ).toHaveValue( '2026-11-28T09:00' );

		fireEvent.click( toggle );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save redirect' } ) );

		expect( update.mutate ).toHaveBeenCalledWith(
			expect.objectContaining( { start_at: null, end_at: null } ),
			expect.anything()
		);
	} );

	it( 'explains a wildcard source and drops the badge for regex', () => {
		render( <RedirectDrawer item={ null } onClose={ jest.fn() } /> );

		expect( screen.getByText( /Use \* to match everything under a path/ ) ).toBeInTheDocument();
		expect( screen.queryByText( 'Wildcard' ) ).toBeNull();

		fireEvent.change( screen.getByLabelText( 'Old URL' ), { target: { value: '/blog/*' } } );
		expect( screen.getByText( 'Wildcard' ) ).toBeInTheDocument();
		// Upstream's "enable regex" nudge is wrong advice for a wildcard.
		expect( screen.queryByText( /enable the "regex" option/ ) ).toBeNull();

		fireEvent.click( screen.getByLabelText( 'Regular expression' ) );
		expect( screen.queryByText( 'Wildcard' ) ).toBeNull();
	} );
} );

describe( 'RedirectDrawer check before saving', () => {
	function checkReturns( data: object ) {
		( useRedirectCheck as jest.Mock ).mockReturnValue( { data, isPlaceholderData: false } );
	}

	function openWith( target: string ) {
		render( <RedirectDrawer item={ null } initialUrl="/old" onClose={ jest.fn() } /> );
		fireEvent.change( screen.getByLabelText( 'Send visitors to' ), { target: { value: target } } );
	}

	it( 'checks the typed redirect, and the one being edited by id', () => {
		render( <RedirectDrawer item={ redirect307 } onClose={ jest.fn() } /> );

		expect( useRedirectCheck ).toHaveBeenLastCalledWith( { source: '/promo', target: '/sale', id: 5 }, true );
	} );

	// The check runs once typing pauses, so results appear after the debounce.
	it( 'offers to point a chain straight to its final destination', async () => {
		checkReturns( { status: 'chain', path: [ '/old', '/middle', '/final' ], final_target: '/final' } );
		openWith( '/middle' );

		expect( await screen.findByText( /\/old → \/middle → \/final/ ) ).toBeInTheDocument();
		fireEvent.click( screen.getByRole( 'button', { name: 'Point straight to /final' } ) );

		expect( screen.getByLabelText( 'Send visitors to' ) ).toHaveValue( '/final' );
	} );

	it( 'blocks saving a loop', async () => {
		checkReturns( { status: 'loop', path: [ '/old', '/back', '/old' ] } );
		openWith( '/back' );

		expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( '/old → /back → /old' );
		expect( screen.getByRole( 'button', { name: 'Save redirect' } ) ).toBeDisabled();
	} );

	it( 'links to the redirect that already uses the old URL', async () => {
		checkReturns( { status: 'duplicate', existing_id: 9 } );
		openWith( '/new' );

		expect( await screen.findByRole( 'link', { name: /View it/ } ) ).toHaveAttribute(
			'href',
			'#/redirects?filterby%5Burl%5D=%2Fold'
		);
		expect( screen.getByRole( 'button', { name: 'Save redirect' } ) ).toBeEnabled();
	} );

	it( 'confirms a clean redirect', async () => {
		checkReturns( { status: 'ok' } );
		openWith( '/new' );

		expect( await screen.findByText( 'No chains or loops.' ) ).toBeInTheDocument();
	} );

	it( 'skips the check for wildcards and regex, which it cannot follow', async () => {
		checkReturns( { status: 'loop', path: [ '/x', '/x' ] } );
		render( <RedirectDrawer item={ null } initialUrl="/blog/*" onClose={ jest.fn() } /> );
		fireEvent.change( screen.getByLabelText( 'Send visitors to' ), { target: { value: '/news/*' } } );

		await waitFor( () =>
			expect( useRedirectCheck ).toHaveBeenLastCalledWith(
				{ source: '/blog/*', target: '/news/*', id: 0 },
				false
			)
		);
		expect( screen.queryByRole( 'alert' ) ).toBeNull();
		expect( screen.getByRole( 'button', { name: 'Save redirect' } ) ).toBeEnabled();
	} );

	it( 'warns without blocking when the destination leads into an existing loop', async () => {
		checkReturns( { status: 'chain', path: [ '/old', '/a', '/b', '/a' ] } );
		openWith( '/a' );

		expect( await screen.findByText( /already loops: \/old → \/a → \/b → \/a/ ) ).toBeInTheDocument();
		expect( screen.queryByRole( 'button', { name: /Point straight/ } ) ).toBeNull();
		expect( screen.getByRole( 'button', { name: 'Save redirect' } ) ).toBeEnabled();
	} );
} );
