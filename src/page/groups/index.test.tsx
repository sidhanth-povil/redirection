import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useGroupBulkAction, useGroupCreate, useGroupList, useGroupUpdate } from 'lib/api/hooks';
import { useTableStore } from 'stores';
import { getInitialGroup } from 'lib/log-constants';
import Groups from 'page/groups';

// `stores` resolves to an automock in src/__mocks__; the page needs the real table state.
jest.mock( 'stores', () => jest.requireActual( '../../stores' ) );
jest.mock( 'lib/api/hooks', () => ( {
	useGroupList: jest.fn(),
	useGroupBulkAction: jest.fn(),
	useGroupCreate: jest.fn(),
	useGroupUpdate: jest.fn(),
} ) );

const rows = [
	{ id: 1, name: 'Redirections', redirects: 1, module_id: 1, enabled: true },
	{ id: 2, name: 'Old server', redirects: 6, module_id: 2, enabled: false },
];

const bulk = { mutate: jest.fn() };
const create = { mutate: jest.fn() };
const update = { mutate: jest.fn() };

const ALL_CAPS = [ 'redirection_cap_group_add', 'redirection_cap_group_delete', 'redirection_cap_redirect_manage' ];

function setup( capabilities = ALL_CAPS ) {
	window.Redirectioni10n = { caps: { capabilities, pages: [ 'groups' ] } } as any;
	( useGroupList as jest.Mock ).mockReturnValue( { data: { items: rows, total: 2 }, isFetching: false } );
	( useGroupBulkAction as jest.Mock ).mockReturnValue( bulk );
	( useGroupCreate as jest.Mock ).mockReturnValue( create );
	( useGroupUpdate as jest.Mock ).mockReturnValue( update );

	return render( <Groups /> );
}

function row( name: string ): HTMLElement {
	return screen.getByText( name ).closest( 'tr' ) as HTMLElement;
}

beforeEach( () => {
	jest.clearAllMocks();
	window.location.hash = '#/groups';
	useTableStore.getState().setGroupsTable( getInitialGroup() as any );
} );

describe( 'Groups page', () => {
	it( 'shows name, module, redirect count and a Disabled badge', () => {
		setup();

		const old = row( 'Old server' );
		expect( within( old ).getByText( 'Apache' ) ).toBeInTheDocument();
		expect( within( old ).getByText( '6' ) ).toBeInTheDocument();
		expect( within( old ).getByText( 'Disabled' ) ).toBeInTheDocument();
		expect( within( row( 'Redirections' ) ).queryByText( 'Disabled' ) ).toBeNull();
	} );

	it( 'adds a group with a name and module', () => {
		setup();

		fireEvent.change( screen.getByLabelText( 'New group name' ), { target: { value: 'Campaigns' } } );
		fireEvent.change( screen.getByLabelText( 'Module' ), { target: { value: '3' } } );
		fireEvent.click( screen.getByRole( 'button', { name: 'Add group' } ) );

		expect( create.mutate ).toHaveBeenCalledWith( { name: 'Campaigns', moduleId: 3, position: 0 } );
	} );

	it( 'edits the name and module in place', () => {
		setup();

		fireEvent.click( within( row( 'Redirections' ) ).getByRole( 'button', { name: 'Edit' } ) );
		fireEvent.change( screen.getByLabelText( 'Group name' ), { target: { value: 'Main' } } );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save' } ) );

		expect( update.mutate ).toHaveBeenCalledWith( { id: 1, name: 'Main', moduleId: 1 } );
	} );

	it( 'enables, disables and deletes', () => {
		setup();
		jest.spyOn( window, 'confirm' ).mockReturnValue( true );

		fireEvent.click( within( row( 'Redirections' ) ).getByRole( 'button', { name: 'Disable' } ) );
		expect( bulk.mutate ).toHaveBeenLastCalledWith( { action: 'disable', items: [ 1 ] } );

		fireEvent.click( within( row( 'Old server' ) ).getByRole( 'button', { name: 'Enable' } ) );
		expect( bulk.mutate ).toHaveBeenLastCalledWith( { action: 'enable', items: [ 2 ] } );

		fireEvent.click( within( row( 'Old server' ) ).getByRole( 'button', { name: 'Delete' } ) );
		expect( bulk.mutate ).toHaveBeenLastCalledWith( { action: 'delete', items: [ 2 ] } );
	} );

	it( 'links to the redirects in a group', () => {
		setup();

		expect( within( row( 'Old server' ) ).getByRole( 'link', { name: 'View redirects' } ) ).toHaveAttribute(
			'href',
			'#/redirects?filterby%5Bgroup%5D=2'
		);
	} );

	it( 'hides adding and editing without the group capability', () => {
		setup( [ 'redirection_cap_redirect_manage' ] );

		expect( screen.queryByLabelText( 'New group name' ) ).toBeNull();
		expect( within( row( 'Redirections' ) ).queryByRole( 'button', { name: 'Edit' } ) ).toBeNull();
		expect( within( row( 'Redirections' ) ).queryByRole( 'button', { name: 'Delete' } ) ).toBeNull();
	} );
} );
