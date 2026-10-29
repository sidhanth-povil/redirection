<?php

namespace Redirection\Health;

use Redirection\Redirect\Schedule;
use Redirection\Url\Matcher;

/**
 * Finds redirect chains (A→B→C) and loops (A→B→A) among plain redirects.
 * find() and check() are pure (no WordPress): edges come in with normalised keys, see load().
 *
 * ponytail: regex/wildcard redirects are skipped, because following them means testing every URL against every
 * pattern; add pattern-aware walking if real data shows chains hiding behind regex.
 * ponytail: URLs with a query string are not followed (exact-query matching makes /a?x and /a different
 * redirects); follow them per the matched redirect's flag_query if chains through queries turn up.
 * ponytail: keys are case- and slash-insensitive (upstream's match_url form), so a case-sensitive redirect whose
 * target differs only in case is reported too; honour per-redirect flags if that shows up.
 *
 * @phpstan-type Edge array{id: int, source: string, target_key: string|null, target: string, hits: int}
 * @phpstan-type Walk array{status: 'ok'|'chain'|'loop', path: list<string>, final_target: string}
 */
class Chains {
	const STATUS_OK = 'ok';
	const STATUS_CHAIN = 'chain';
	const STATUS_LOOP = 'loop';
	const STATUS_DUPLICATE = 'duplicate';

	/** Source, middle hop and final target. */
	const MIN_CHAIN_NODES = 3;

	/**
	 * @var list<Edge>
	 */
	private $edges;

	/**
	 * Source key → edge.
	 *
	 * @var array<string, Edge>
	 */
	private $map;

	/**
	 * @param list<Edge> $edges Edges in match order (position, then id). A null target_key is external.
	 */
	public function __construct( array $edges ) {
		$this->edges = $edges;
		$this->map = self::to_map( $edges );
	}

	/**
	 * A source matched by several redirects keeps the first, as matching does.
	 *
	 * @param list<Edge> $edges Edges in match order.
	 * @return array<string, Edge>
	 */
	private static function to_map( array $edges ) {
		$map = [];

		foreach ( $edges as $edge ) {
			if ( ! isset( $map[ $edge['source'] ] ) ) {
				$map[ $edge['source'] ] = $edge;
			}
		}

		return $map;
	}

	/**
	 * Enabled, live, plain URL redirects. Computed per request with no cache: one query plus an O(n) walk.
	 * ponytail: no cache; if /health gets slow on big sites, add a transient cleared on redirect changes.
	 *
	 * @return Chains
	 */
	public static function load() {
		global $wpdb;

		$sql = "SELECT id, url, match_url, action_data, last_count FROM {$wpdb->prefix}redirection_items
			WHERE status='enabled' AND regex=0 AND match_type='url' AND action_type='url'";

		if ( Schedule::columns_ready() ) {
			$now = Schedule::now();
			$sql .= $wpdb->prepare( ' AND (start_at IS NULL OR start_at <= %s) AND (end_at IS NULL OR end_at > %s)', $now, $now );
		}

		$edges = [];

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		foreach ( (array) $wpdb->get_results( $sql . ' ORDER BY position, id' ) as $row ) {
			$target = is_string( $row->action_data ) ? $row->action_data : '';

			if ( $target === '' || ! self::is_followable( $row->url ) ) {
				continue;
			}

			$edges[] = [
				'id' => intval( $row->id, 10 ),
				'source' => $row->match_url,
				'target_key' => self::target_key( $target ),
				'target' => $target,
				'hits' => intval( $row->last_count, 10 ),
			];
		}

		return new Chains( $edges );
	}

	/**
	 * @param string $url Source URL as typed.
	 * @return bool Whether the walk can follow it: anything with a query string is left alone.
	 */
	public static function is_followable( $url ) {
		return strpos( $url, '?' ) === false;
	}

	/**
	 * @param string $url Source URL as typed.
	 * @return string The same key upstream stores in match_url.
	 */
	public static function source_key( $url ) {
		return ( new Matcher( $url ) )->get_url();
	}

	/**
	 * @param string $target Target URL as typed.
	 * @return string|null Key of a relative or same-host target, null for anywhere else.
	 */
	public static function target_key( $target ) {
		$parts = wp_parse_url( $target );

		if ( ! is_array( $parts ) ) {
			return null;
		}

		if ( isset( $parts['query'] ) ) {
			return null;
		}

		$home = (string) wp_parse_url( home_url(), PHP_URL_HOST );

		if ( isset( $parts['host'] ) && self::bare_host( $parts['host'] ) !== self::bare_host( $home ) ) {
			return null;
		}

		return self::source_key( $parts['path'] ?? '/' );
	}

	/**
	 * @param string $host Host name.
	 * @return string Lowercase, without a leading www.
	 */
	private static function bare_host( $host ) {
		return (string) preg_replace( '/^www\./', '', strtolower( $host ) );
	}

	/**
	 * Every redirect whose target is itself redirected. Each member of a chain is reported, so flattening them all
	 * leaves none; a redirect leading into a loop counts as a loop.
	 *
	 * @return array{chains: list<array{id: int, path: list<string>, final_target: string, hits: int}>, loops: list<array{id: int, path: list<string>, hits: int}>}
	 */
	public function find() {
		$chains = [];
		$loops = [];

		foreach ( $this->map as $edge ) {
			$walk = self::walk( $edge, $this->map );

			if ( $walk['status'] === self::STATUS_LOOP ) {
				$loops[] = [ 'id' => $edge['id'], 'path' => $walk['path'], 'hits' => $edge['hits'] ];
			} elseif ( $walk['status'] === self::STATUS_CHAIN ) {
				$chains[] = [
					'id' => $edge['id'],
					'path' => $walk['path'],
					'final_target' => $walk['final_target'],
					'hits' => $edge['hits'],
				];
			}
		}

		return [ 'chains' => $chains, 'loops' => $loops ];
	}

	/**
	 * Check a redirect before it is saved. Only a loop back to the source blocks saving, so it wins over a duplicate
	 * or chain. Leading into a loop elsewhere is reported as a chain with no final target.
	 *
	 * @param string      $source Source key.
	 * @param string|null $target_key Target key, null when external.
	 * @param string      $target Target as typed.
	 * @param int         $id Redirect being edited, ignored in the map; 0 for a new one.
	 * @return array{status: string, path?: list<string>, final_target?: string, existing_id?: int}
	 */
	public function check( $source, $target_key, $target, $id = 0 ) {
		$map = self::to_map(
			array_values(
				array_filter(
					$this->edges,
					static function ( $edge ) use ( $id ) {
						return $edge['id'] !== $id;
					}
				)
			)
		);
		$existing = $map[ $source ] ?? null;
		$candidate = [ 'id' => $id, 'source' => $source, 'target_key' => $target_key, 'target' => $target, 'hits' => 0 ];
		$map[ $source ] = $candidate;
		$walk = self::walk( $candidate, $map );

		if ( $walk['status'] === self::STATUS_LOOP ) {
			if ( end( $walk['path'] ) === $source ) {
				return [ 'status' => self::STATUS_LOOP, 'path' => $walk['path'] ];
			}

			return [ 'status' => self::STATUS_CHAIN, 'path' => $walk['path'] ];
		}

		if ( $existing !== null ) {
			return [ 'status' => self::STATUS_DUPLICATE, 'existing_id' => $existing['id'] ];
		}

		if ( $walk['status'] === self::STATUS_CHAIN ) {
			return [ 'status' => self::STATUS_CHAIN, 'path' => $walk['path'], 'final_target' => $walk['final_target'] ];
		}

		return [ 'status' => self::STATUS_OK ];
	}

	/**
	 * Does a redirect already start at this key? Then sending visitors to it adds a hop.
	 *
	 * @param string $key Source or target key.
	 * @return bool
	 */
	public function leads_on( $key ) {
		return isset( $this->map[ $key ] );
	}

	/**
	 * Redirects whose target is this source: once it is saved they reach the page through it, a chain the drawer
	 * offers to avoid by repointing them. Leaves out the redirect being edited and any that would then point at itself.
	 *
	 * @param string      $source Source key.
	 * @param string|null $target_key Target key of the redirect being saved, null when external.
	 * @param int         $id Redirect being edited; 0 for a new one.
	 * @return list<int>
	 */
	public function inbound( $source, $target_key, $id = 0 ) {
		$ids = [];

		foreach ( $this->edges as $edge ) {
			if ( $edge['target_key'] === $source && $edge['id'] !== $id && $edge['source'] !== $target_key ) {
				$ids[] = $edge['id'];
			}
		}

		return $ids;
	}

	/**
	 * Follow targets through the map. O(n) per walk thanks to the visited set.
	 *
	 * @param Edge                $edge Starting redirect.
	 * @param array<string, Edge> $map Source key → edge.
	 * @return Walk
	 */
	private static function walk( array $edge, array $map ) {
		$path = [ $edge['source'] ];
		$seen = [ $edge['source'] => true ];

		while ( $edge['target_key'] !== null && isset( $map[ $edge['target_key'] ] ) ) {
			$key = $edge['target_key'];
			$path[] = $key;

			if ( isset( $seen[ $key ] ) ) {
				return [ 'status' => self::STATUS_LOOP, 'path' => $path, 'final_target' => '' ];
			}

			$seen[ $key ] = true;
			$edge = $map[ $key ];
		}

		$path[] = $edge['target'];

		return [
			'status' => count( $path ) >= self::MIN_CHAIN_NODES ? self::STATUS_CHAIN : self::STATUS_OK,
			'path' => $path,
			'final_target' => $edge['target'],
		];
	}
}
