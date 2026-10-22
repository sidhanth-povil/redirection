<?php

namespace Redirection\Api\Route;

use Redirection\Api\Route as BaseRoute;
use Redirection\Health\Chains;
use Redirection\Redirect\Redirect as RedirectItem;
use Redirection\Redirect\Schedule;
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
	 * @param WP_REST_Request<array<string, mixed>> $request Request.
	 * @return array<string, mixed>
	 */
	public function route_check( WP_REST_Request $request ) {
		$source = (string) $request['source'];
		$target = (string) $request['target'];

		// Wildcards are matched as patterns, which the chain walk skips.
		if ( strpos( $source, '*' ) !== false ) {
			return [ 'status' => Chains::STATUS_OK ];
		}

		return Chains::load()->check( Chains::source_key( $source ), Chains::target_key( $target ), $target, intval( $request['id'], 10 ) );
	}

	/**
	 * @param WP_REST_Request<array<string, mixed>> $request Request.
	 * @return array{counts: array<string, int>, attention: list<array<string, mixed>>}
	 */
	public function route_health( WP_REST_Request $request ) {
		$found = Chains::load()->find();
		$errors = $this->get_404s();
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

		// A loop breaks the page for every visitor, so loops come first; then whatever is hit most.
		usort(
			$attention,
			static function ( $first, $second ) {
				return [ $first['type'] !== 'loop', $second['hits'] ] <=> [ $second['type'] !== 'loop', $first['hits'] ];
			}
		);

		return [
			'counts' => [
				'active' => $this->count_active( $has_schedule ),
				'new404s' => $errors['total'],
				'chains' => count( $found['chains'] ),
				'loops' => count( $found['loops'] ),
				'scheduled' => $has_schedule ? $this->count_scheduled() : 0,
			],
			'attention' => array_slice( $attention, 0, self::MAX_ATTENTION ),
		];
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

			if ( ! $this->is_redirected( $row->url ) ) {
				$items[] = [ 'type' => '404', 'url' => $row->url, 'hits' => intval( $row->hits, 10 ) ];
			}
		}

		return [ 'total' => intval( $total, 10 ), 'items' => $items ];
	}

	/**
	 * @param string $url Requested URL.
	 * @return bool
	 */
	private function is_redirected( $url ) {
		foreach ( RedirectItem::get_for_matched_url( $url ) as $item ) {
			if ( $item->get_match( $url ) !== false ) {
				return true;
			}
		}

		return false;
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
