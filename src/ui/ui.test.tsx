import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Badge, Button, Drawer, Field, Segmented } from 'ui';

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

describe( 'Field', () => {
	it( 'labels its control and renders the hint', () => {
		render(
			<Field label="Old URL" htmlFor="src" hint="The address people visit now">
				<input id="src" aria-describedby="src-hint" />
			</Field>
		);

		expect( screen.getByLabelText( 'Old URL' ) ).toHaveAccessibleDescription( 'The address people visit now' );
	} );
} );

describe( 'Badge', () => {
	it( 'renders the tone class', () => {
		render( <Badge tone="success">Permanent</Badge> );

		expect( screen.getByText( 'Permanent' ) ).toHaveClass( 'dsr-badge', 'dsr-badge--success' );
	} );
} );

describe( 'Segmented', () => {
	const options = [
		{ value: 'permanent' as const, label: 'Permanent', hint: '301' },
		{ value: 'gone' as const, label: 'Gone', hint: '410' },
	];

	it( 'is a labelled radio group with the current value checked', () => {
		render( <Segmented label="Type" options={ options } value="gone" onChange={ jest.fn() } /> );

		expect( screen.getByRole( 'group', { name: 'Type' } ) ).toBeInTheDocument();
		expect( screen.getByRole( 'radio', { name: /Gone/ } ) ).toBeChecked();
		expect( screen.getByRole( 'radio', { name: /Permanent/ } ) ).not.toBeChecked();
	} );

	it( 'reports the picked value', () => {
		const onChange = jest.fn();
		render( <Segmented label="Type" options={ options } value={ null } onChange={ onChange } /> );

		fireEvent.click( screen.getByRole( 'radio', { name: /Permanent/ } ) );

		expect( onChange ).toHaveBeenCalledWith( 'permanent' );
	} );
} );

describe( 'Drawer', () => {
	it( 'renders nothing when closed', () => {
		render(
			<Drawer open={ false } title="New redirect" onClose={ jest.fn() }>
				<p>body</p>
			</Drawer>
		);

		expect( screen.queryByRole( 'dialog' ) ).toBeNull();
	} );

	it( 'is a labelled modal dialog inside a .dsr-app root', () => {
		render(
			<Drawer open title="New redirect" onClose={ jest.fn() } footer={ <Button>Save</Button> }>
				<p>body</p>
			</Drawer>
		);

		const dialog = screen.getByRole( 'dialog', { name: 'New redirect' } );
		expect( dialog ).toHaveAttribute( 'aria-modal', 'true' );
		expect( dialog.closest( '.dsr-app' ) ).not.toBeNull();
		expect( screen.getByRole( 'button', { name: 'Save' } ) ).toBeInTheDocument();
	} );

	it( 'closes on Escape and on the close button', () => {
		const onClose = jest.fn();
		render(
			<Drawer open title="New redirect" onClose={ onClose }>
				<p>body</p>
			</Drawer>
		);

		fireEvent.keyDown( document, { key: 'Escape' } );
		fireEvent.click( screen.getByRole( 'button', { name: 'Close' } ) );

		expect( onClose ).toHaveBeenCalledTimes( 2 );
	} );
} );
