<?php

namespace Redirection\Health;

/**
 * Finds redirect chains (A→B→C) and loops (A→B→A) among plain redirects.
 * Pure (no WordPress): edges come in with normalised keys, see load().
 *
 * ponytail: regex/wildcard redirects are skipped, because following them means testing every URL against every
 * pattern; add pattern-aware walking if real data shows chains hiding behind regex.
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
	 * Source key → edge. A source matched by several redirects keeps the first, as matching does.
	 *
	 * @var array<string, Edge>
	 */
	private $map = [];

	/**
	 * @param list<Edge> $edges Edges in match order (position, then id). A null target_key is external.
	 */
	public function __construct( array $edges ) {
		foreach ( $edges as $edge ) {
			if ( ! isset( $this->map[ $edge['source'] ] ) ) {
				$this->map[ $edge['source'] ] = $edge;
			}
		}
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
	 * Check a redirect before it is saved. A loop blocks saving, so it wins over a duplicate or chain.
	 *
	 * @param string      $source Source key.
	 * @param string|null $target_key Target key, null when external.
	 * @param string      $target Target as typed.
	 * @param int         $id Redirect being edited, ignored in the map; 0 for a new one.
	 * @return array{status: string, path?: list<string>, final_target?: string, existing_id?: int}
	 */
	public function check( $source, $target_key, $target, $id = 0 ) {
		$map = array_filter(
			$this->map,
			static function ( $edge ) use ( $id ) {
				return $edge['id'] !== $id;
			}
		);
		$existing = $map[ $source ] ?? null;
		$candidate = [ 'id' => $id, 'source' => $source, 'target_key' => $target_key, 'target' => $target, 'hits' => 0 ];
		$map[ $source ] = $candidate;
		$walk = self::walk( $candidate, $map );

		if ( $walk['status'] === self::STATUS_LOOP ) {
			return [ 'status' => self::STATUS_LOOP, 'path' => $walk['path'] ];
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
