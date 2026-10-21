<?php

namespace Redirection\Redirect;

use DateTimeImmutable;
use DateTimeZone;
use Exception;

/**
 * Rules for scheduled redirects: dates are stored as UTC `Y-m-d H:i:s`, NULL meaning unbounded.
 * A redirect is active from start_at (inclusive) until end_at (exclusive).
 */
class Schedule {
	const DB_FORMAT = 'Y-m-d H:i:s';
	const VERSION_OPTION = 'dsr_db_version';

	const STATE_NONE = 'none';
	const STATE_SCHEDULED = 'scheduled';
	const STATE_LIVE = 'live';
	const STATE_EXPIRED = 'expired';

	/**
	 * Read a date from the API. Input without an offset is in the site timezone.
	 *
	 * @param mixed        $value ISO 8601 or `Y-m-d H:i[:s]`.
	 * @param DateTimeZone $site Site timezone.
	 * @return string|null|false UTC DB value, null when empty, false when unreadable.
	 */
	public static function parse( $value, DateTimeZone $site ) {
		if ( $value === null || ( is_string( $value ) && trim( $value ) === '' ) ) {
			return null;
		}

		if ( ! is_string( $value ) ) {
			return false;
		}

		try {
			$date = new DateTimeImmutable( trim( $value ), $site );
		} catch ( Exception $e ) {
			return false;
		}

		return $date->setTimezone( new DateTimeZone( 'UTC' ) )->format( self::DB_FORMAT );
	}

	/**
	 * @param string|null $start UTC start.
	 * @param string|null $end UTC end.
	 * @return bool
	 */
	public static function is_valid_window( $start, $end ) {
		return $start === null || $end === null || $end > $start;
	}

	/**
	 * DB values are fixed-width UTC strings, so string comparison is chronological.
	 *
	 * @param string|null $start UTC start.
	 * @param string|null $end UTC end.
	 * @param string      $now UTC now.
	 * @return bool
	 */
	public static function is_active( $start, $end, $now ) {
		return ( $start === null || $start <= $now ) && ( $end === null || $end > $now );
	}

	/**
	 * @param string|null $start UTC start.
	 * @param string|null $end UTC end.
	 * @param string      $now UTC now.
	 * @return string One of the STATE_ constants.
	 */
	public static function state( $start, $end, $now ) {
		if ( $start === null && $end === null ) {
			return self::STATE_NONE;
		}

		if ( $start !== null && $start > $now ) {
			return self::STATE_SCHEDULED;
		}

		if ( $end !== null && $end <= $now ) {
			return self::STATE_EXPIRED;
		}

		return self::STATE_LIVE;
	}

	/**
	 * @param string|null  $utc UTC DB value.
	 * @param DateTimeZone $site Site timezone.
	 * @return string|null ISO 8601 with the site offset.
	 */
	public static function to_site_iso( $utc, DateTimeZone $site ) {
		if ( $utc === null ) {
			return null;
		}

		return ( new DateTimeImmutable( $utc, new DateTimeZone( 'UTC' ) ) )->setTimezone( $site )->format( 'c' );
	}

	/**
	 * @return string
	 */
	public static function now() {
		return gmdate( self::DB_FORMAT );
	}

	/**
	 * Whether the DSuite schedule columns exist (dsr_db_version 1+), repairing a stale version option.
	 *
	 * @return bool
	 */
	public static function columns_ready() {
		global $wpdb;

		if ( intval( get_option( self::VERSION_OPTION, 0 ), 10 ) < 1 ) {
			return false;
		}

		// Only saves and filtered lists ask, never front-end matching, so this check is cheap enough.
		if ( $wpdb->get_var( "SHOW COLUMNS FROM `{$wpdb->prefix}redirection_items` LIKE 'end_at'" ) !== null ) {
			return true;
		}

		// The option claims columns a recreated table lacks: add them back now.
		return \Redirection\Database\DsrUpgrader::run();
	}
}
