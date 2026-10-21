import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Shell from 'app/shell';

describe( 'Shell', () => {
	it( 'renders one link per allowed route and marks the current one', () => {
		render(
			<Shell routes={ [ 'redirects', '404s', 'settings' ] } current="404s" title="404s">
				<p>content</p>
			</Shell>
		);

		const nav = screen.getByRole( 'navigation', { name: 'DSuite Redirects' } );
		const links = nav.querySelectorAll( 'a' );

		expect( links ).toHaveLength( 3 );
		expect( screen.getByRole( 'link', { name: '404s' } ) ).toHaveAttribute( 'aria-current', 'page' );
		expect( screen.getByRole( 'link', { name: 'Redirects' } ) ).not.toHaveAttribute( 'aria-current' );
		expect( screen.getByRole( 'link', { name: 'Settings' } ) ).toHaveAttribute( 'href', '#/settings' );
		expect( screen.queryByRole( 'link', { name: 'Logs' } ) ).toBeNull();
	} );

	it( 'renders the title, actions and content', () => {
		render(
			<Shell
				routes={ [ 'redirects' ] }
				current="redirects"
				title="Redirects"
				actions={ <button type="button">Add</button> }
			>
				<p>content</p>
			</Shell>
		);

		expect( screen.getByRole( 'heading', { level: 1, name: 'Redirects' } ) ).toBeInTheDocument();
		expect( screen.getByRole( 'button', { name: 'Add' } ) ).toBeInTheDocument();
		expect( screen.getByText( 'content' ).closest( '.dsr-main' ) ).toHaveClass( 'redirection' );
	} );

	it( 'tells the parent before navigating', () => {
		const onNavigate = jest.fn();
		render(
			<Shell routes={ [ 'redirects', 'logs' ] } current="redirects" title="Redirects" onNavigate={ onNavigate }>
				<p>content</p>
			</Shell>
		);

		screen.getByRole( 'link', { name: 'Logs' } ).click();

		expect( onNavigate ).toHaveBeenCalledWith( 'logs' );
	} );
} );
