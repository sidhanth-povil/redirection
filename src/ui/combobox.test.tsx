import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Combobox, type ComboboxOptionItem } from 'ui';

// Headless UI measures elements; jsdom has no ResizeObserver.
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as any;

function Harness( {
	search,
	onChange,
}: {
	search: ( query: string ) => Promise< ComboboxOptionItem[] >;
	onChange: jest.Mock;
} ) {
	const [ value, setValue ] = useState( '' );

	return (
		<>
			<label htmlFor="target">Send visitors to</label>
			<Combobox
				id="target"
				value={ value }
				search={ search }
				onChange={ ( next ) => {
					setValue( next );
					onChange( next );
				} }
			/>
		</>
	);
}

describe( 'Combobox', () => {
	beforeEach( () => jest.useFakeTimers() );
	afterEach( () => jest.useRealTimers() );

	it( 'keeps free text as the value', () => {
		const onChange = jest.fn();
		render( <Harness search={ jest.fn().mockResolvedValue( [] ) } onChange={ onChange } /> );

		fireEvent.change( screen.getByLabelText( 'Send visitors to' ), { target: { value: 'https://example.com/x' } } );

		expect( onChange ).toHaveBeenLastCalledWith( 'https://example.com/x' );
	} );

	it( 'searches after a pause and fills in the picked option', async () => {
		const onChange = jest.fn();
		const search = jest
			.fn()
			.mockResolvedValue( [ { value: '/autumn-sale/', label: 'Autumn Sale', detail: 'page · /autumn-sale/' } ] );
		render( <Harness search={ search } onChange={ onChange } /> );

		fireEvent.change( screen.getByLabelText( 'Send visitors to' ), { target: { value: 'sale' } } );
		await act( async () => {
			jest.advanceTimersByTime( 300 );
		} );

		expect( search ).toHaveBeenCalledWith( 'sale' );

		// Headless UI selects on pointer events and settles state on the next frame.
		jest.useRealTimers();
		const option = await screen.findByRole( 'option', { name: /Autumn Sale/ } );
		fireEvent.pointerDown( option );
		fireEvent.mouseDown( option );
		fireEvent.pointerUp( option );
		fireEvent.mouseUp( option );
		fireEvent.click( option );

		expect( onChange ).toHaveBeenLastCalledWith( '/autumn-sale/' );
	} );

	it( 'does not search for fewer than 2 characters', async () => {
		const search = jest.fn().mockResolvedValue( [] );
		render( <Harness search={ search } onChange={ jest.fn() } /> );

		fireEvent.change( screen.getByLabelText( 'Send visitors to' ), { target: { value: 's' } } );
		await act( async () => {
			jest.advanceTimersByTime( 300 );
		} );

		expect( search ).not.toHaveBeenCalled();
	} );
} );
