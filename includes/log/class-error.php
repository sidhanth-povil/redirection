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
	 * Grouped by URL, each row also says when it was last seen, where visitors mostly came from, and which page it
	 * should probably redirect to.
	 *
	 * @param string               $group Group type ('ip'|'url'|'agent').
	 * @param array<string, mixed> $params Filter params.
	 * @phpstan-return array{items: list<object>, total: int}
	 * @return array
	 */
	public static function get_grouped( $group, array $params ) {
		global $wpdb;

		$result = parent::get_grouped( $group, $params );
		$urls = array_column( $result['items'], 'url' );

		if ( $group !== 'url' || count( $urls ) === 0 ) {
			return $result;
		}

		$placeholders = implode( ',', array_fill( 0, count( $urls ), '%s' ) );
		$last_seen = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders built above.
				"SELECT url, MAX(created) AS last_seen FROM {$wpdb->prefix}redirection_404 WHERE url IN ({$placeholders}) GROUP BY url",
				$urls
			)
		);
		$referrers = self::get_top_referrers( $urls );
		$suggestions = Suggest::for_urls( $urls );

		// The URL column's collation ignores case, so a query can return another spelling of the same URL.
		$seen = [];
		foreach ( (array) $last_seen as $row ) {
			$seen[ strtolower( $row->url ) ] = (string) $row->last_seen;
		}

		/** @var \stdClass $row Rows are plain database objects. */
		foreach ( $result['items'] as $row ) {
			$row->last_seen = $seen[ strtolower( $row->url ) ] ?? '';
			$row->referrer = $referrers[ $row->url ] ?? '';
			$row->suggestion = $suggestions[ $row->url ] ?? '';
		}

		return $result;
	}

	/**
	 * Adds `since` (days) and `ignored` (whether a "do nothing" redirect exists for the URL).
	 *
	 * @param array<string, mixed> $filter Array of filter params.
	 * @return list<string>
	 */
	protected static function get_query_filter( array $filter ) {
		global $wpdb;

		// @phpstan-ignore argument.type
		$where = parent::get_query_filter( $filter );

		if ( isset( $filter['since'] ) && intval( $filter['since'], 10 ) > 0 ) {
			// 404 rows store site-local time (current_time( 'mysql' )).
			$where[] = $wpdb->prepare( 'created >= %s', wp_date( 'Y-m-d H:i:s', time() - intval( $filter['since'], 10 ) * DAY_IN_SECONDS ) );
		}

		if ( isset( $filter['ignored'] ) && in_array( $filter['ignored'], [ '0', '1' ], true ) ) {
			$ignored = "SELECT url FROM {$wpdb->prefix}redirection_items WHERE action_type='nothing' AND status='enabled'";
			$where[] = 'url ' . ( $filter['ignored'] === '1' ? 'IN' : 'NOT IN' ) . " ({$ignored})";
		}

		return $where;
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
		// Keyed case-insensitively: the URL column's collation folds case, so rows may use another spelling.
		$top = [];

		foreach ( (array) $rows as $row ) {
			$key = strtolower( $row->url );

			if ( ! isset( $top[ $key ] ) ) {
				$top[ $key ] = (string) $row->referrer;
			}
		}

		$referrers = [];

		foreach ( $urls as $url ) {
			$referrers[ $url ] = $top[ strtolower( $url ) ] ?? '';
		}

		return $referrers;
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
