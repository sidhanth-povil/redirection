import { __, sprintf } from '@wordpress/i18n';
import {
	ACTION_ERROR,
	ACTION_NOTHING,
	ACTION_PASS,
	ACTION_RANDOM,
	ACTION_URL,
	MATCH_LOGIN,
	MATCH_URL,
} from 'lib/redirect-constants';
import type { BadgeTone } from 'ui';
import type { Redirect } from 'types';

const CODE_GONE = 410;

function targetUrl( row: Redirect ): string {
	const data = row.action_data as Record< string, unknown > | null | undefined;

	return typeof data?.url === 'string' ? data.url : '';
}

/**
 * One line under the old URL saying where visitors go.
 * @param row
 */
export function describeTarget( row: Redirect ): string {
	if ( row.match_type !== MATCH_URL ) {
		return row.match_type === MATCH_LOGIN
			? __( 'Depends on login status', 'dsuite-redirects' )
			: __( 'Conditional redirect', 'dsuite-redirects' );
	}

	switch ( row.action_type ) {
		case ACTION_URL:
			return targetUrl( row );
		case ACTION_ERROR:
			return row.action_code === CODE_GONE
				? __( 'Gone (410)', 'dsuite-redirects' )
				: /* translators: %d: HTTP status code */ sprintf(
						__( 'Error page (%d)', 'dsuite-redirects' ),
						row.action_code
				  );
		case ACTION_PASS:
			/* translators: %s: URL */
			return sprintf( __( 'Pass-through to %s', 'dsuite-redirects' ), targetUrl( row ) );
		case ACTION_RANDOM:
			return __( 'Random post', 'dsuite-redirects' );
		case ACTION_NOTHING:
			return __( 'Do nothing (log only)', 'dsuite-redirects' );
	}

	return '';
}

export function typeBadge( row: Redirect ): { tone: BadgeTone; label: string; code: number } {
	const code = row.action_code;

	if ( row.action_type === ACTION_ERROR ) {
		return { tone: 'danger', label: code === CODE_GONE ? __( 'Gone', 'dsuite-redirects' ) : String( code ), code };
	}

	if ( code === 301 ) {
		return { tone: 'success', label: __( 'Permanent', 'dsuite-redirects' ), code };
	}

	if ( code === 302 ) {
		return { tone: 'info', label: __( 'Temporary', 'dsuite-redirects' ), code };
	}

	return { tone: 'neutral', label: String( code ), code };
}

// Read the calendar date in the ISO string's own (site) time, so it never shifts with the browser's timezone.
function shortDate( iso: string ): string {
	const [ year, month, day ] = iso.slice( 0, 10 ).split( '-' ).map( Number );

	const locale = window.Redirectioni10n?.locale || 'en-US';

	return new Intl.DateTimeFormat( locale, { month: 'short', day: 'numeric', timeZone: 'UTC' } ).format(
		new Date( Date.UTC( year ?? 1970, ( month ?? 1 ) - 1, day ?? 1 ) )
	);
}

/**
 * A second badge for redirects with a schedule, or null when there is nothing to say.
 * @param row
 */
export function scheduleBadge( row: Redirect ): { tone: BadgeTone; label: string } | null {
	if ( row.schedule_state === 'scheduled' && row.start_at ) {
		/* translators: %s: short date, e.g. "Nov 28" */
		return { tone: 'warning', label: sprintf( __( 'Starts %s', 'dsuite-redirects' ), shortDate( row.start_at ) ) };
	}

	if ( row.schedule_state === 'live' && row.end_at ) {
		/* translators: %s: short date, e.g. "Dec 2" */
		return { tone: 'warning', label: sprintf( __( 'Until %s', 'dsuite-redirects' ), shortDate( row.end_at ) ) };
	}

	if ( row.schedule_state === 'expired' ) {
		return { tone: 'neutral', label: __( 'Expired', 'dsuite-redirects' ) };
	}

	return null;
}

export function isWildcardRow( row: Redirect ): boolean {
	return row.match_data?.source?.flag_wildcard === true;
}
