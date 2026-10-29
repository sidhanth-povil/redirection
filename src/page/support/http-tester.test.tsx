import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRedirectTrace } from 'lib/api/hooks';
import HttpTester from './http-tester';

jest.mock( 'lib/api/hooks', () => ( { useRedirectTrace: jest.fn() } ) );

function setup( outcome: { hops?: unknown[]; loop?: boolean; error?: string } ) {
	const mutate = jest.fn( ( _url, { onSuccess, onError } ) =>
		outcome.error
			? onError( new Error( outcome.error ) )
			: onSuccess( { hops: outcome.hops, loop: outcome.loop ?? false } )
	);
	( useRedirectTrace as jest.Mock ).mockReturnValue( { mutate, isPending: false } );
	render( <HttpTester /> );

	fireEvent.change( screen.getByLabelText( 'Address on this site' ), { target: { value: '/a' } } );
	fireEvent.click( screen.getByRole( 'button', { name: 'Check' } ) );

	return mutate;
}

describe( 'HttpTester', () => {
	it( 'checks from the server and lists every hop', () => {
		const mutate = setup( {
			hops: [
				{ url: '/a', code: 301, location: '/b', external: false, ms: 12 },
				{ url: '/b', code: 200, location: '', external: false, ms: 9 },
			],
		} );

		expect( mutate ).toHaveBeenCalledWith( '/a', expect.anything() );
		const hops = screen.getAllByRole( 'listitem' );
		expect( hops[ 0 ] ).toHaveTextContent( '/a301→ /b' );
		expect( hops[ 1 ] ).toHaveTextContent( '/b200' );
		expect( screen.getByText( '1 redirect before the page loads.' ) ).toBeInTheDocument();
	} );

	it( 'says when a hop leaves the site', () => {
		setup( { hops: [ { url: '/a', code: 301, location: 'https://other.example/', external: true, ms: 5 } ] } );

		expect( screen.getByText( 'Goes to another site, which is not checked.' ) ).toBeInTheDocument();
	} );

	it( 'warns about a loop', () => {
		setup( {
			loop: true,
			hops: [
				{ url: '/a', code: 301, location: '/b', external: false, ms: 5 },
				{ url: '/b', code: 301, location: '/a', external: false, ms: 5 },
			],
		} );

		expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'These redirects go round in a loop.' );
	} );

	it( 'shows why a check could not run', () => {
		setup( { error: 'Only addresses on this site can be checked.' } );

		expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'Only addresses on this site can be checked.' );
	} );

	it( 'no longer sends addresses to an outside service', () => {
		setup( { hops: [] } );

		expect( screen.queryByText( /redirect\.li/ ) ).toBeNull();
	} );
} );
