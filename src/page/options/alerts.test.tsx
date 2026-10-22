import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSettingsUpdate } from 'lib/api/hooks/use-settings';
import { useSettingsStore } from 'stores';
import Alerts from './alerts';

jest.mock( 'stores', () => jest.requireActual( '../../stores' ) );
jest.mock( 'lib/api/hooks/use-settings', () => ( { useSettingsUpdate: jest.fn() } ) );

const update = { mutate: jest.fn(), isPending: false };

function setup( values: object = {} ) {
	( useSettingsUpdate as jest.Mock ).mockReturnValue( update );
	useSettingsStore.getState().setValues( {
		expire_404: 7,
		dsr_alerts: { enabled: false, frequency: 'weekly', recipients: [ 'admin@example.com' ], min_hits: 3 },
		...values,
	} as any );

	return render( <Alerts /> );
}

beforeEach( () => jest.clearAllMocks() );

describe( '404 alerts settings', () => {
	it( 'saves the alert settings on their own', () => {
		setup();

		fireEvent.click( screen.getByRole( 'switch', { name: 'Email new 404s' } ) );
		fireEvent.change( screen.getByLabelText( 'How often' ), { target: { value: 'daily' } } );
		fireEvent.change( screen.getByLabelText( 'Send to' ), { target: { value: 'a@example.com, b@example.com' } } );
		fireEvent.change( screen.getByLabelText( 'Only URLs with at least' ), { target: { value: '5' } } );
		fireEvent.click( screen.getByRole( 'button', { name: 'Save alerts' } ) );

		expect( update.mutate ).toHaveBeenCalledWith( {
			dsr_alerts: {
				enabled: true,
				frequency: 'daily',
				recipients: [ 'a@example.com', 'b@example.com' ],
				min_hits: 5,
			},
		} );
	} );

	it( 'points out an address that is not an email', () => {
		setup();

		fireEvent.change( screen.getByLabelText( 'Send to' ), { target: { value: 'a@example.com, nope' } } );

		expect( screen.getByRole( 'alert' ) ).toHaveTextContent( 'nope' );
		expect( screen.getByRole( 'button', { name: 'Save alerts' } ) ).toBeDisabled();
	} );

	it( 'warns when alerts are on but 404 logging is off', () => {
		setup( {
			expire_404: -1,
			dsr_alerts: { enabled: true, frequency: 'weekly', recipients: [ 'admin@example.com' ], min_hits: 3 },
		} );

		expect( screen.getByText( /404 logging is off/ ) ).toBeInTheDocument();
	} );
} );
