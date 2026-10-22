<?php

namespace Redirection\Log;

/**
 * @phpstan-type Log404Row object{
 *   id: int,
 *   created: string,
 *   url: string,
 *   agent: string,
 *   referrer: string,
 *   ip: string,
 *   domain?: string
 * }
 *
 * 404 error logging. Extends the base log class with specifics for 404s
 */
class Error extends Log {
	/**
	 * Get's the table name for this log object
	 *
	 * @param \wpdb $wpdb WPDB object.
	 * @return string
	 */
	protected static function get_table_name( $wpdb ) {
		return "{$wpdb->prefix}redirection_404";
	}

	/**
	 * Create a 404 log entry
	 *
	 * @param string $domain Domain name of request.
	 * @param string $url URL of request.
	 * @param string $ip IP of client.
	 * @param array<string, mixed> $details Other log details.
	 * @return int|false Log ID, or false
	 */
	public static function create( $domain, $url, $ip, array $details ) {
		global $wpdb;

		$insert = static::sanitize_create( $domain, $url, $ip, $details );
		$insert = apply_filters( 'redirection_404_data', $insert );

		if ( $insert ) {
			do_action( 'redirection_404', $insert );

			$wpdb->insert( $wpdb->prefix . 'redirection_404', $insert );
			if ( $wpdb->insert_id ) {
				return $wpdb->insert_id;
			}
		}

		return false;
	}

	/**
	 * The most common referrer of each URL, in one query.
	 *
	 * @param list<string> $urls 404 URLs.
	 * @return array<string, string> URL → top referrer ('' when none).
	 */
	public static function get_top_referrers( array $urls ) {
		global $wpdb;

		if ( count( $urls ) === 0 ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $urls ), '%s' ) );
		// Most hits first, so the first referrer seen for a URL is its top one.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders built above.
				"SELECT url, referrer, COUNT(*) AS hits FROM {$wpdb->prefix}redirection_404 WHERE url IN ({$placeholders}) AND referrer IS NOT NULL AND referrer != '' GROUP BY url, referrer ORDER BY hits DESC",
				$urls
			)
		);
		$top = array_fill_keys( $urls, '' );

		foreach ( (array) $rows as $row ) {
			if ( $top[ $row->url ] === '' ) {
				$top[ $row->url ] = (string) $row->referrer;
			}
		}

		return $top;
	}

	/**
	 * Get the CSV filename for this log object
	 *
	 * @return string
	 */
	public static function get_csv_filename() {
		return 'redirection-404';
	}

	/**
	 * Get the CSV headers for this log object
	 *
	 * @return array<int, string>
	 */
	public static function get_csv_header() {
		return [ 'date', 'source', 'ip', 'referrer', 'useragent' ];
	}

	/**
	 * @return array<string, string>
	 */
	protected static function get_export_field_labels() {
		return [
			'date' => 'date',
			'method' => 'method',
			'domain' => 'domain',
			'url' => 'source',
			'code' => 'code',
			'referrer' => 'referrer',
			'agent' => 'useragent',
			'ip' => 'ip',
			'count' => 'count',
		];
	}

	/**
	 * Get the CSV row for this log object
	 *
	 * @param object $row Log row.
	 * @return array<int, string|int>
	 */
	public static function get_csv_row( $row ) {
		/** @var Log404Row $row */
		return [
			$row->created,
			$row->url,
			$row->ip,
			$row->referrer,
			$row->agent,
		];
	}
}
