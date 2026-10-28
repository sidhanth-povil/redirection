import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import HelpCards from 'page/overview/help-cards';

beforeEach( () => window.localStorage.clear() );

const titlesIn = ( name: string ) =>
	within( screen.getByRole( 'region', { name } ) )
		.getAllByRole( 'heading', { level: 4 } )
		.map( ( heading ) => heading.textContent );

test( 'starts a new team member with where things are and the everyday tasks', () => {
	render( <HelpCards /> );

	expect( titlesIn( 'Start here' ) ).toEqual( [
		'Find your way around',
		'Add a redirect',
		'Campaign links with UTM tags',
		'Fix 404s',
		'Check a redirect works',
	] );

	const start = screen.getByRole( 'region', { name: 'Start here' } );
	expect( within( start ).getByRole( 'link', { name: 'Go to 404s' } ) ).toHaveAttribute( 'href', '#/404s' );
	expect( within( start ).getByRole( 'link', { name: 'Open the Redirect Tester' } ) ).toHaveAttribute(
		'href',
		'#/support'
	);
	// A campaign link only redirects when its query parameters are ignored
	expect( within( start ).getByText( /Ignore & pass parameters to the target/ ) ).toBeInTheDocument();
} );

test( 'explains how redirects work, whole sections, scheduling, groups, loops, renamed pages and bulk changes', () => {
	render( <HelpCards /> );

	expect( titlesIn( 'Good to know' ) ).toEqual( [
		'How a redirect works',
		'Move a whole section',
		'Scheduling',
		'Groups',
		'Chains & loops',
		'A page changed its address',
		'Many redirects at once',
	] );

	const more = screen.getByRole( 'region', { name: 'Good to know' } );
	expect( within( more ).getByRole( 'link', { name: 'Go to Groups' } ) ).toHaveAttribute( 'href', '#/groups' );
	expect( within( more ).getByRole( 'link', { name: 'Go to Import / Export' } ) ).toHaveAttribute(
		'href',
		'#/import-export'
	);
	// Enabling a group turns on redirects that were switched off one by one
	expect( within( more ).getByText( /switched off one by one/ ) ).toBeInTheDocument();
} );

test( 'stays hidden after hiding it, across visits', () => {
	const { unmount } = render( <HelpCards /> );

	fireEvent.click( screen.getByRole( 'button', { name: 'Hide' } ) );
	expect( screen.queryByRole( 'heading', { name: 'Groups' } ) ).toBeNull();
	unmount();

	render( <HelpCards /> );
	expect( screen.queryByRole( 'heading', { name: 'Groups' } ) ).toBeNull();
	fireEvent.click( screen.getByRole( 'button', { name: 'Show' } ) );
	expect( screen.getByRole( 'heading', { name: 'Groups' } ) ).toBeInTheDocument();
} );

test( 'still opens and hides when storage is blocked', () => {
	const getItem = jest.spyOn( Storage.prototype, 'getItem' ).mockImplementation( () => {
		throw new Error( 'blocked' );
	} );
	const setItem = jest.spyOn( Storage.prototype, 'setItem' ).mockImplementation( () => {
		throw new Error( 'blocked' );
	} );

	render( <HelpCards /> );
	expect( screen.getByRole( 'heading', { name: 'Groups' } ) ).toBeInTheDocument();
	fireEvent.click( screen.getByRole( 'button', { name: 'Hide' } ) );
	expect( screen.queryByRole( 'heading', { name: 'Groups' } ) ).toBeNull();

	getItem.mockRestore();
	setItem.mockRestore();
} );
