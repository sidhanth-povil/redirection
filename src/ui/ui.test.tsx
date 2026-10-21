import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Button } from 'ui';

describe( 'Button', () => {
	it( 'defaults to a non-submitting secondary button', () => {
		render( <Button>Cancel</Button> );

		const button = screen.getByRole( 'button', { name: 'Cancel' } );
		expect( button ).toHaveAttribute( 'type', 'button' );
		expect( button ).toHaveClass( 'dsr-button', 'dsr-button--secondary' );
	} );

	it( 'applies the primary variant and passes through props', () => {
		const onClick = jest.fn();
		render(
			<Button variant="primary" onClick={ onClick } className="extra" aria-describedby="hint">
				Save
			</Button>
		);

		const button = screen.getByRole( 'button', { name: 'Save' } );
		button.click();

		expect( onClick ).toHaveBeenCalledTimes( 1 );
		expect( button ).toHaveClass( 'dsr-button--primary', 'extra' );
		expect( button ).toHaveAttribute( 'aria-describedby', 'hint' );
	} );

	it( 'allows a submit button', () => {
		render( <Button type="submit">Go</Button> );

		expect( screen.getByRole( 'button', { name: 'Go' } ) ).toHaveAttribute( 'type', 'submit' );
	} );
} );
