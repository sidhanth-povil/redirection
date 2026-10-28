import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import HelpCards from 'page/overview/help-cards';

beforeEach( () => window.localStorage.clear() );

test( 'explains redirects, scheduling, groups, and chains and loops', () => {
	render( <HelpCards /> );

	const help = screen.getByRole( 'region', { name: 'How it works' } );
	const titles = within( help )
		.getAllByRole( 'heading', { level: 3 } )
		.map( ( heading ) => heading.textContent );

	expect( titles ).toEqual( [ 'How a redirect works', 'Scheduling', 'Groups', 'Chains & loops' ] );
	expect( within( help ).getByRole( 'link', { name: 'Go to Redirects' } ) ).toHaveAttribute( 'href', '#/redirects' );
	expect( within( help ).getByRole( 'link', { name: 'Go to Groups' } ) ).toHaveAttribute( 'href', '#/groups' );
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
