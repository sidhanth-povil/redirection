import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TrafficResponse } from 'types';
import TrafficChart from 'page/overview/traffic-chart';

const week = ( retention = { redirect: 7, error: 7 } ): TrafficResponse => ( {
	days: Array.from( { length: 7 }, ( _, index ) => ( {
		date: `2026-10-${ 21 + index }`,
		redirects: index * 2,
		errors: index === 6 ? 3 : 1,
	} ) ),
	top: [],
	retention,
} );

test( 'draws one bar group per day', () => {
	const { container } = render( <TrafficChart traffic={ week() } days={ 7 } onDaysChange={ jest.fn() } /> );

	expect( container.querySelectorAll( '.dsr-traffic__day' ) ).toHaveLength( 7 );
} );

test( 'lists every day in a table for screen readers', () => {
	render( <TrafficChart traffic={ week() } days={ 7 } onDaysChange={ jest.fn() } /> );

	const rows = within( screen.getByRole( 'table' ) ).getAllByRole( 'row' );
	// Header row plus one per day.
	expect( rows ).toHaveLength( 8 );
	expect( rows[ 7 ] ).toHaveTextContent( /27.*12.*3/ );
} );

test( 'shows the totals for the range', () => {
	render( <TrafficChart traffic={ week() } days={ 7 } onDaysChange={ jest.fn() } /> );

	expect( screen.getByText( '42' ) ).toBeInTheDocument();
	expect( screen.getByText( '9' ) ).toBeInTheDocument();
} );

test( 'asks for 30 days when the range changes', () => {
	const onDaysChange = jest.fn();
	render( <TrafficChart traffic={ week( { redirect: 0, error: 60 } ) } days={ 7 } onDaysChange={ onDaysChange } /> );

	fireEvent.click( screen.getByLabelText( '30 days' ) );

	expect( onDaysChange ).toHaveBeenCalledWith( 30 );
} );

test( 'offers 30 days only when a log keeps that long', () => {
	render( <TrafficChart traffic={ week() } days={ 7 } onDaysChange={ jest.fn() } /> );

	expect( screen.getByLabelText( '30 days' ) ).toBeDisabled();
	expect( screen.getByLabelText( '7 days' ) ).toBeEnabled();
} );

test( 'says when the logs keep fewer days than the range', () => {
	render( <TrafficChart traffic={ week( { redirect: 14, error: -1 } ) } days={ 30 } onDaysChange={ jest.fn() } /> );

	expect( screen.getByText( /last 14 days your logs keep/ ) ).toBeInTheDocument();
} );

test( 'links to Settings when redirect logging is off', () => {
	render( <TrafficChart traffic={ week( { redirect: -1, error: 7 } ) } days={ 7 } onDaysChange={ jest.fn() } /> );

	expect( screen.getByText( /Redirect logging is off/ ) ).toBeInTheDocument();
	expect( screen.getByRole( 'link', { name: /Settings/ } ) ).toHaveAttribute( 'href', '#/settings' );
} );

test( 'shows a day on focus', () => {
	const { container } = render( <TrafficChart traffic={ week() } days={ 7 } onDaysChange={ jest.fn() } /> );

	fireEvent.focus( container.querySelectorAll( '.dsr-traffic__day' )[ 6 ] );

	expect( screen.getByRole( 'tooltip' ) ).toHaveTextContent( /27.*12 redirects.*3 404 hits/ );
} );

test( 'offers a retry when traffic fails to load', () => {
	const onRetry = jest.fn();
	render( <TrafficChart traffic={ undefined } isError days={ 7 } onDaysChange={ jest.fn() } onRetry={ onRetry } /> );

	expect( screen.queryByText( 'Loading…' ) ).toBeNull();
	fireEvent.click( screen.getByRole( 'button', { name: 'Try again' } ) );
	expect( onRetry ).toHaveBeenCalled();
} );

test( 'announces each day as an image with its values', () => {
	render( <TrafficChart traffic={ week() } days={ 7 } onDaysChange={ jest.fn() } /> );

	expect( screen.getAllByRole( 'img' ) ).toHaveLength( 7 );
	expect( screen.getAllByRole( 'img' )[ 6 ] ).toHaveAccessibleName( /27.*12 redirects.*3 404 hits/ );
} );
