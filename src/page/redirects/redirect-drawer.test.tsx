import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useGroupDropdown, useRedirectCreate, useRedirectUpdate } from 'lib/api/hooks';
import type { Redirect } from 'types';
import RedirectDrawer from './redirect-drawer';

jest.mock( 'lib/api/hooks', () => ( {
	useGroupDropdown: jest.fn(),
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
const update = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null as Error | null };

beforeEach( () => {
	jest.clearAllMocks();
	create.error = null;
	( useGroupDropdown as jest.Mock ).mockReturnValue( { data: { items: [ { id: 1, name: 'Redirections' } ] } } );
	( useRedirectCreate as jest.Mock ).mockReturnValue( create );
	( useRedirectUpdate as jest.Mock ).mockReturnValue( update );
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
} );
