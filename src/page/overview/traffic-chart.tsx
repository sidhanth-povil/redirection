import { useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { buildHash } from 'app/router';
import { Segmented } from 'ui';
import type { TrafficRange, TrafficResponse } from 'types';

interface TrafficChartProps {
	traffic: TrafficResponse | undefined;
	days: TrafficRange;
	onDaysChange: ( days: TrafficRange ) => void;
}

type Day = TrafficResponse[ 'days' ][ number ];

// Retention values from the settings: -1 = not logged, 0 = kept forever, otherwise days kept.
const NOT_LOGGED = -1;
const FOREVER = 0;
const LONG_RANGE = 30;

function dayLabel( date: string ): string {
	return new Date( `${ date }T00:00:00` ).toLocaleDateString( undefined, { month: 'short', day: 'numeric' } );
}

function describeDay( day: Day ): string {
	return sprintf(
		/* translators: 1: date, 2: e.g. "12 redirects", 3: e.g. "3 404s" */
		__( '%1$s: %2$s · %3$s', 'dsuite-redirects' ),
		dayLabel( day.date ),
		/* translators: %d: number of redirected visits */
		sprintf( _n( '%d redirect', '%d redirects', day.redirects, 'dsuite-redirects' ), day.redirects ),
		/* translators: %d: number of 404 visits */
		sprintf( _n( '%d 404', '%d 404s', day.errors, 'dsuite-redirects' ), day.errors )
	);
}

function LoggingOff( { message }: { message: string } ) {
	return (
		<p className="dsr-traffic__notice">
			{ message }{ ' ' }
			<a className="dsr-link" href={ buildHash( 'settings' ) }>
				{ __( 'Turn it on in Settings', 'dsuite-redirects' ) }
			</a>
		</p>
	);
}

export default function TrafficChart( { traffic, days, onDaysChange }: TrafficChartProps ) {
	const [ active, setActive ] = useState< number | null >( null );

	if ( ! traffic ) {
		return (
			<section className="dsr-card dsr-traffic">
				<p className="dsr-empty">{ __( 'Loading…', 'dsuite-redirects' ) }</p>
			</section>
		);
	}

	const { retention } = traffic;
	const kept = [ retention.redirect, retention.error ].filter( ( value ) => value !== NOT_LOGGED );
	const canShowMonth = kept.some( ( value ) => value === FOREVER || value >= LONG_RANGE );
	const shortest = Math.min( ...kept.filter( ( value ) => value > FOREVER ) );
	const max = Math.max( 1, ...traffic.days.map( ( day ) => Math.max( day.redirects, day.errors ) ) );
	const totalRedirects = traffic.days.reduce( ( sum, day ) => sum + day.redirects, 0 );
	const totalErrors = traffic.days.reduce( ( sum, day ) => sum + day.errors, 0 );
	const height = ( value: number ) => `${ ( value / max ) * 100 }%`;

	return (
		<section className="dsr-card dsr-traffic" aria-labelledby="dsr-traffic-title">
			<header className="dsr-traffic__header">
				<div>
					<h2 id="dsr-traffic-title" className="dsr-section-title">
						{ __( 'Traffic', 'dsuite-redirects' ) }
					</h2>
					<p className="dsr-traffic__totals">
						<span className="dsr-traffic__total dsr-traffic__total--redirects">
							<strong>{ totalRedirects }</strong> { __( 'redirected', 'dsuite-redirects' ) }
						</span>
						<span className="dsr-traffic__total dsr-traffic__total--errors">
							<strong>{ totalErrors }</strong> { __( '404s', 'dsuite-redirects' ) }
						</span>
					</p>
				</div>
				<Segmented< string >
					label={ __( 'Range', 'dsuite-redirects' ) }
					value={ String( days ) }
					onChange={ ( value ) => onDaysChange( Number( value ) as TrafficRange ) }
					options={ [
						{ value: '7', label: __( '7 days', 'dsuite-redirects' ) },
						{ value: '30', label: __( '30 days', 'dsuite-redirects' ), disabled: ! canShowMonth },
					] }
				/>
			</header>

			{ retention.redirect === NOT_LOGGED && (
				<LoggingOff
					message={ __(
						'Redirect logging is off, so redirected visits are not counted.',
						'dsuite-redirects'
					) }
				/>
			) }
			{ retention.error === NOT_LOGGED && (
				<LoggingOff
					message={ __( '404 logging is off, so missing pages are not counted.', 'dsuite-redirects' ) }
				/>
			) }
			{ shortest < days && (
				<p className="dsr-traffic__notice">
					{ sprintf(
						/* translators: %d: number of days the logs are kept */
						__( 'Showing the last %d days your logs keep.', 'dsuite-redirects' ),
						shortest
					) }
				</p>
			) }

			<div
				className={ `dsr-traffic__plot dsr-traffic__plot--${ days }` }
				onMouseLeave={ () => setActive( null ) }
			>
				{ traffic.days.map( ( day, index ) => (
					<div
						key={ day.date }
						className="dsr-traffic__day"
						// eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard users reach each day's tooltip.
						tabIndex={ 0 }
						aria-label={ describeDay( day ) }
						onFocus={ () => setActive( index ) }
						onBlur={ () => setActive( null ) }
						onMouseEnter={ () => setActive( index ) }
					>
						<div className="dsr-traffic__bars" aria-hidden="true">
							<span
								className="dsr-traffic__bar dsr-traffic__bar--redirects"
								style={ { height: height( day.redirects ) } }
							/>
							<span
								className="dsr-traffic__bar dsr-traffic__bar--errors"
								style={ { height: height( day.errors ) } }
							/>
						</div>
						<span className="dsr-traffic__label" aria-hidden="true">
							{ dayLabel( day.date ) }
						</span>
						{ active === index && (
							<span role="tooltip" className="dsr-traffic__tooltip">
								{ describeDay( day ) }
							</span>
						) }
					</div>
				) ) }
			</div>

			<table className="screen-reader-text">
				<caption>{ __( 'Visits per day', 'dsuite-redirects' ) }</caption>
				<thead>
					<tr>
						<th scope="col">{ __( 'Day', 'dsuite-redirects' ) }</th>
						<th scope="col">{ __( 'Redirected', 'dsuite-redirects' ) }</th>
						<th scope="col">{ __( '404s', 'dsuite-redirects' ) }</th>
					</tr>
				</thead>
				<tbody>
					{ traffic.days.map( ( day ) => (
						<tr key={ day.date }>
							<th scope="row">{ dayLabel( day.date ) }</th>
							<td>{ day.redirects }</td>
							<td>{ day.errors }</td>
						</tr>
					) ) }
				</tbody>
			</table>
		</section>
	);
}
