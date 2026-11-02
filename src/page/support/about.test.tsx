import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import About from './about';

describe( 'About', () => {
	it( 'says Designsuite.ai built the plugin and links to the site in a new tab', () => {
		window.Redirectioni10n = { version: '1.11.0' } as any;
		render( <About /> );

		expect( screen.getByRole( 'heading', { name: 'About DSuite Redirects' } ) ).toBeInTheDocument();
		expect( screen.getByText( /Version 1\.11\.0/ ) ).toBeInTheDocument();

		const link = screen.getByRole( 'link', { name: /Designsuite\.ai/ } );
		expect( link ).toHaveAttribute( 'href', 'https://designsuite.ai' );
		expect( link ).toHaveAttribute( 'target', '_blank' );
		expect( link ).toHaveAttribute( 'rel', 'noopener noreferrer' );
	} );
} );
