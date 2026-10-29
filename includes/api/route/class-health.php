<?php

namespace Redirection\Api\Route;

use Redirection\Api\Route as BaseRoute;
use Redirection\Health\Chains;
use Redirection\Redirect\Redirect as RedirectItem;
use Redirection\Redirect\Schedule;
use Redirection\Settings\Settings;
use WP_REST_Request;
use WP_REST_Server;

/**
 * Read-only health of the redirects: what Overview shows, and the drawer's check before saving.
 * Flattening a chain has no endpoint; the client saves each chain's final_target with the redirect update route.
 */
class Health extends BaseRoute {
	const WINDOW_DAYS = 7;
	const MAX_404S = 10;
	// Some of the top 404s may already be fixed by a redirect, so fetch more than are shown.
	const MAX_404_CANDIDATES = 30;
	const MAX_ATTENTION = 50;
	const TRAFFIC_RANGES = [ 7, 30 ];
	const MAX_TOP = 5;
	// ponytail: the top-redirects GROUP BY reads every log row in the range; cached rather than indexed so no ALTER
	// runs on a big log table. A (created, redirection_id) index in DsrUpgrader if a busy site still stalls.
	const TRAFFIC_CACHE_SECONDS = 5 * MINUTE_IN_SECONDS;

	/**
	 * @param non-falsy-string $api_namespace REST namespace.
	 */
	public function __construct( $api_namespace ) {
		register_rest_route(
			$api_namespace,
			'/health',
			[
				[
					'methods' => WP_REST_Server::READABLE,
					'callback' => [ $this, 'route_health' ],
					'permission_callback' => [ $this, 'permission_callback_manage' ],
				],
			]
		);

		register_rest_route(
			$api_namespace,
			'/health/traffic',
			[
				[
					'methods' => WP_REST_Server::READABLE,
					'callback' => [ $this, 'route_traffic' ],
					'permission_callback' => [ $this, 'permission_callback_manage' ],
					'args' => [
						'days' => [
							'type' => 'integer',
							'required' => true,
							'enum' => self::TRAFFIC_RANGES,
						],
					],
				],
			]
		);

		register_rest_route(
			$api_namespace,
			'/check',
			[
				[
					'methods' => WP_REST_Server::CREATABLE,
					'callback' => [ $this, 'route_check' ],
					'permission_callback' => [ $this, 'permission_callback_manage' ],
					'args' => [
						'source' => [
							'type' => 'string',
							'required' => true,
						],
						'target' => [
							'type' => 'string',
							'required' => true,
						],
						'id' => [
							'type' => 'integer',
							'default' => 0,
							'minimum' => 0,
						],
					],
				],
			]
		);
	}

	/**
	 * @param WP_REST_Request<array<string, mixed>> $request Request.
	 * @return bool
	 */
	public function permission_callback_manage( WP_REST_Request $request ) {
		return \Redirection_Capabilities::has_access( \Redirection_Capabilities::CAP_REDIRECT_MANAGE );
	}

	/**
	 * @return string
	 */
	private function get_db_error() {
		global $wpdb;

		return $wpdb->last_error;
	}

	/**
	 * @return bool
	 */
	private function can_see_404s() {
		return \Redirection_Capabilities::has_access( \Redirection_Capabilities::CAP_404_MANAGE );
	}

	/**
	 * @param WP_REST_Request<array<string, mixed>> $request Request.
	 * @return array<string, mixed>
	 */
	public function route_check( WP_REST_Request $request ) {
		$source = (string) $request['source'];
		$target = (string) $request['target'];

		// Wildcards are matched as patterns and query sources by their query, which the chain walk skips.
		if ( strpos( $source, '*' ) !== false || ! Chains::is_followable( $source ) ) {
			return [ 'status' => Chains::STATUS_OK ];
		}

		$chains = Chains::load();
		$id = intval( $request['id'], 10 );
		$source_key = Chains::source_key( $source );
		$target_key = Chains::target_key( $target );
		$result = $chains->check( $source_key, $target_key, $target, $id );

		// A loop blocks saving, so there is nothing to repoint.
		if ( $result['status'] === Chains::STATUS_LOOP ) {
			return $result;
		}

		$inbound = [];
		foreach ( $chains->inbound( $source_key, $target_key, $id ) as $inbound_id ) {
			$redirect = RedirectItem::get_by_id( $inbound_id );
			if ( $redirect !== false ) {
				$inbound[] = $redirect->to_json();
			}
		}

		// Full redirects, so the drawer can save each with a new target through the usual update route, like Flatten.
		return count( $inbound ) > 0 ? array_merge( $result, [ 'inbound' => $inbound ] ) : $result;
	}

	/**
	 * @param WP_REST_Request<array<string, mixed>> $request Request.
	 * @return array{counts: array<string, int>, attention: list<array<string, mixed>>}
	 */
	public function route_health( WP_REST_Request $request ) {
		$found = Chains::load()->find();
		// The 404 log is its own capability; a redirect-only delegate must not read it through here
		$errors = $this->can_see_404s() ? $this->get_404s() : [ 'items' => [], 'total' => 0 ];
		$has_schedule = Schedule::columns_ready();
		$expiring = $has_schedule ? $this->get_expiring() : [];
		$redirects = $this->get_redirect_json( array_merge( array_column( $found['chains'], 'id' ), array_column( $found['loops'], 'id' ) ) );

		$attention = $errors['items'];

		foreach ( $found['loops'] as $loop ) {
			$attention[] = [ 'type' => 'loop' ] + $loop + [ 'redirect' => $redirects[ $loop['id'] ] ?? null ];
		}

		foreach ( $found['chains'] as $chain ) {
			$attention[] = [ 'type' => 'chain' ] + $chain + [ 'redirect' => $redirects[ $chain['id'] ] ?? null ];
		}

		foreach ( $expiring as $item ) {
			$attention[] = [
				'type' => 'expiring',
				'id' => $item->get_id(),
				'hits' => $item->get_hits(),
				'end_at' => Schedule::to_site_iso( $item->get_end_at(), wp_timezone() ),
				'redirect' => $item->to_json(),
			];
		}

		// A loop breaks the page for every visitor, so loops come first; this week's 404s next. Within a group, the
		// most hit first (404 hits are this week's, redirect hits lifetime, so groups aren't compared by hits).
		$rank = array_flip( [ 'loop', '404', 'chain', 'expiring' ] );
		usort(
			$attention,
			static function ( $first, $second ) use ( $rank ) {
				return [ $rank[ $first['type'] ], $second['hits'] ] <=> [ $rank[ $second['type'] ], $first['hits'] ];
			}
		);

		return [
			'counts' => [
				'active' => $this->count_active( $has_schedule ),
				'new404s' => $errors['total'],
				'chains' => count( $found['chains'] ),
				'loops' => count( $found['loops'] ),
				'scheduled' => $has_schedule ? $this->count_scheduled() : 0,
				'unused' => $this->count_unused(),
			],
			'attention' => array_slice( $attention, 0, self::MAX_ATTENTION ),
		];
	}

	/**
	 * Hits per site-local day from the logs, oldest first, and the most hit redirects in the same days.
	 * The logs only hold what their retention keeps, so the retention goes back too.
	 *
	 * @param WP_REST_Request<array<string, mixed>> $request Request.
	 * @return array{days: list<array{date: string, redirects: int, errors: int}>, top: list<array<string, mixed>>, retention: array{redirect: int, error: int}}
	 */
	public function route_traffic( WP_REST_Request $request ) {
		$days = intval( $request['days'], 10 );
		$key = 'dsr_traffic_' . $days;
		$traffic = get_transient( $key );

		if ( ! is_array( $traffic ) ) {
			global $wpdb;

			$wpdb->last_error = '';
			$traffic = $this->get_traffic( $days );

			// A failed query reads as no traffic; don't keep that for the next five minutes
			if ( $this->get_db_error() === '' ) {
				set_transient( $key, $traffic, self::TRAFFIC_CACHE_SECONDS );
			}
		}

		/** @var array{days: list<array{date: string, redirects: int, errors: int}>, top: list<array<string, mixed>>} $traffic */
		$settings = Settings::get();

		if ( ! $this->can_see_404s() ) {
			$traffic['days'] = array_map(
				static function ( $day ) {
					return [ 'errors' => 0 ] + $day;
				},
				$traffic['days']
			);
		}

		// Not cached: turning logging on or off in Settings shows straight away.
		return $traffic + [
			'retention' => [
				'redirect' => intval( $settings['expire_redirect'], 10 ),
				'error' => intval( $settings['expire_404'], 10 ),
			],
		];
	}

	/**
	 * @param int $days Days back, today included.
	 * @return array{days: list<array{date: string, redirects: int, errors: int}>, top: list<array<string, mixed>>}
	 */
	private function get_traffic( $days ) {
		global $wpdb;

		$today = new \DateTimeImmutable( 'today', wp_timezone() );
		$dates = [];

		for ( $back = $days - 1; $back >= 0; $back-- ) {
			$dates[] = $today->modify( "-{$back} days" )->format( 'Y-m-d' );
		}

		// Log rows store site-local time (current_time( 'mysql' )), so DATE(created) is already the site's day.
		$since = $dates[0] . ' 00:00:00';
		$redirects = $this->count_by_day( 'redirection_logs', $since );
		$errors = $this->count_by_day( 'redirection_404', $since );

		$rows_by_day = array_map(
			static function ( $date ) use ( $redirects, $errors ) {
				return [
					'date' => $date,
					'redirects' => $redirects[ $date ] ?? 0,
					'errors' => $errors[ $date ] ?? 0,
				];
			},
			$dates
		);

		$rows = (array) $wpdb->get_results(
			$wpdb->prepare(
				"SELECT redirection_id AS id, COUNT(*) AS hits FROM {$wpdb->prefix}redirection_logs
				WHERE created >= %s AND redirection_id > 0 GROUP BY redirection_id ORDER BY hits DESC, id LIMIT %d",
				$since,
				self::MAX_TOP
			)
		);
		$json = $this->get_redirect_json( array_map( 'intval', array_column( $rows, 'id' ) ) );
		$top = [];

		// A deleted redirect keeps its log rows; it has nothing to open, so it is left out.
		foreach ( $rows as $row ) {
			if ( isset( $json[ intval( $row->id, 10 ) ] ) ) {
				$top[] = [ 'id' => intval( $row->id, 10 ), 'hits' => intval( $row->hits, 10 ), 'redirect' => $json[ intval( $row->id, 10 ) ] ];
			}
		}

		return [
			'days' => $rows_by_day,
			'top' => $top,
		];
	}

	/**
	 * @param 'redirection_logs'|'redirection_404' $table Log table, without prefix.
	 * @param string                               $since Site-local start, inclusive.
	 * @return array<string, int> Y-m-d → rows.
	 */
	private function count_by_day( $table, $since ) {
		global $wpdb;

		$rows = $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $table is one of two literals.
			$wpdb->prepare( "SELECT DATE(created) AS day, COUNT(*) AS hits FROM {$wpdb->prefix}{$table} WHERE created >= %s GROUP BY day", $since )
		);

		return array_map( 'intval', array_column( (array) $rows, 'hits', 'day' ) );
	}

	/**
	 * 404s from the last week, by hits, leaving out URLs a live redirect now handles.
	 *
	 * @return array{total: int, items: list<array{type: string, url: string, hits: int}>}
	 */
	private function get_404s() {
		global $wpdb;

		// 404 rows store site-local time (current_time( 'mysql' )).
		$since = wp_date( Schedule::DB_FORMAT, time() - self::WINDOW_DAYS * DAY_IN_SECONDS );
		$total = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(DISTINCT url) FROM {$wpdb->prefix}redirection_404 WHERE created >= %s", $since ) );
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT url, COUNT(*) AS hits FROM {$wpdb->prefix}redirection_404 WHERE created >= %s GROUP BY url ORDER BY hits DESC LIMIT %d", $since, self::MAX_404_CANDIDATES )
		);

		$items = [];

		foreach ( (array) $rows as $row ) {
			if ( count( $items ) >= self::MAX_404S ) {
				break;
			}

			if ( ! RedirectItem::matches_any( $row->url ) ) {
				$items[] = [ 'type' => '404', 'url' => $row->url, 'hits' => intval( $row->hits, 10 ) ];
			}
		}

		return [ 'total' => intval( $total, 10 ), 'items' => $items ];
	}

	/**
	 * @return RedirectItem[] Enabled redirects that end within the window.
	 */
	private function get_expiring() {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}redirection_items WHERE status='enabled' AND end_at > %s AND end_at <= %s ORDER BY end_at LIMIT %d",
				Schedule::now(),
				$this->window_end(),
				self::MAX_ATTENTION
			)
		);

		return array_map(
			static function ( $row ) {
				return new RedirectItem( $row );
			},
			(array) $rows
		);
	}

	/**
	 * @param bool $has_schedule Whether the schedule columns exist.
	 * @return int
	 */
	private function count_active( $has_schedule ) {
		global $wpdb;

		$sql = "SELECT COUNT(*) FROM {$wpdb->prefix}redirection_items WHERE status='enabled'";

		if ( $has_schedule ) {
			$now = Schedule::now();
			$sql .= $wpdb->prepare( ' AND (start_at IS NULL OR start_at <= %s) AND (end_at IS NULL OR end_at > %s)', $now, $now );
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return intval( $wpdb->get_var( $sql ), 10 );
	}

	/**
	 * Same rule as the redirect list's `access=year` filter, which Overview links to.
	 *
	 * @return int Redirects with no hit in a year, never-hit ones included.
	 */
	private function count_unused() {
		global $wpdb;

		return intval( $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}redirection_items WHERE last_access < DATE_SUB(NOW(),INTERVAL 1 YEAR)" ), 10 );
	}

	/**
	 * @return int Enabled redirects that start or end within the window.
	 */
	private function count_scheduled() {
		global $wpdb;

		$now = Schedule::now();
		$end = $this->window_end();

		return intval(
			$wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}redirection_items WHERE status='enabled'
					AND ((start_at > %s AND start_at <= %s) OR (end_at > %s AND end_at <= %s))",
					$now,
					$end,
					$now,
					$end
				)
			),
			10
		);
	}

	/**
	 * @param list<int> $ids Redirect IDs.
	 * @return array<int, array<string, mixed>> ID → redirect JSON, so the client can flatten or edit it.
	 */
	private function get_redirect_json( array $ids ) {
		global $wpdb;

		if ( count( $ids ) === 0 ) {
			return [];
		}

		$in = implode( ',', array_map( 'intval', $ids ) );
		$json = [];

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- integers only.
		foreach ( (array) $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}redirection_items WHERE id IN ({$in})" ) as $row ) {
			$item = new RedirectItem( $row );
			$json[ $item->get_id() ] = $item->to_json();
		}

		return $json;
	}

	/**
	 * @return string UTC end of the "within 7 days" window.
	 */
	private function window_end() {
		return gmdate( Schedule::DB_FORMAT, time() + self::WINDOW_DAYS * DAY_IN_SECONDS );
	}
}
