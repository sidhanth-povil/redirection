<?php

namespace Redirection\Log;

/**
 * Suggests where a 404 should redirect: the published post or page whose slug is closest to the broken URL's last
 * part. /summer-sale-2025 suggests a post named summer-sale, or else one named summer-sale-2026.
 *
 * ponytail: slug matching only, ASCII slugs; percent-encoded non-Latin slugs and title search can come later.
 */
class Suggest {
	const MIN_SLUG_LENGTH = 3;
	const MAX_MATCHES = 20;

	/**
	 * A suggested target path for each URL, or '' when nothing is close enough.
	 *
	 * ponytail: one indexed query per URL, fine for a page of 404s; batch it if the page size grows into hundreds.
	 *
	 * @param list<string> $urls 404 URLs.
	 * @return array<string, string> URL → suggested path.
	 */
	public static function for_urls( array $urls ) {
		$suggestions = [];

		foreach ( $urls as $url ) {
			$suggestions[ $url ] = self::for_url( $url );
		}

		return $suggestions;
	}

	/**
	 * @param string $url 404 URL.
	 * @return string Suggested path, or ''.
	 */
	public static function for_url( $url ) {
		$candidates = self::slug_candidates( $url );
		if ( count( $candidates ) === 0 ) {
			return '';
		}

		$post_id = self::pick( $candidates, self::find_posts( $candidates ) );
		if ( $post_id === 0 ) {
			return '';
		}

		$permalink = get_permalink( $post_id );
		if ( $permalink === false ) {
			return '';
		}

		$path = wp_make_link_relative( $permalink );

		// Suggesting the broken URL itself would make a loop
		$same = untrailingslashit( strtolower( $path ) ) === untrailingslashit( strtolower( (string) strtok( $url, '?' ) ) );

		return $same ? '' : $path;
	}

	/**
	 * Slugs to look for, longest first: the URL's last part, then that part with words dropped from its end.
	 *
	 * @param string $url 404 URL.
	 * @return list<string>
	 */
	public static function slug_candidates( $url ) {
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );
		$parts = array_values( array_filter( explode( '/', $path ), fn( $part ) => $part !== '' ) );
		if ( count( $parts ) === 0 ) {
			return [];
		}

		$last = strtolower( rawurldecode( (string) end( $parts ) ) );
		$last = (string) preg_replace( '/\.(html?|php|aspx?)$/', '', $last );
		$slug = trim( (string) preg_replace( '/[^a-z0-9]+/', '-', $last ), '-' );

		$candidates = [];
		$words = $slug === '' ? [] : explode( '-', $slug );

		while ( count( $words ) > 0 ) {
			$candidate = implode( '-', $words );

			if ( strlen( $candidate ) >= self::MIN_SLUG_LENGTH && preg_match( '/^[0-9-]+$/', $candidate ) !== 1 ) {
				$candidates[] = $candidate;
			}

			array_pop( $words );
		}

		return $candidates;
	}

	/**
	 * The best post: the one whose slug is the longest candidate, else the shortest slug that starts with the full one.
	 *
	 * @param list<string>                             $candidates From slug_candidates().
	 * @param list<object{ID: int, post_name: string}> $posts Possible matches.
	 * @return int Post ID, or 0.
	 */
	public static function pick( array $candidates, array $posts ) {
		if ( count( $candidates ) === 0 ) {
			return 0;
		}

		$by_name = [];
		foreach ( $posts as $post ) {
			$by_name[ $post->post_name ] = (int) $post->ID;
		}

		foreach ( $candidates as $candidate ) {
			if ( isset( $by_name[ $candidate ] ) ) {
				return $by_name[ $candidate ];
			}
		}

		$prefix = $candidates[0] . '-';
		$longer = array_values( array_filter( array_map( 'strval', array_keys( $by_name ) ), fn( $name ) => strpos( $name, $prefix ) === 0 ) );
		if ( count( $longer ) === 0 ) {
			return 0;
		}

		usort( $longer, fn( $first, $second ) => strlen( $first ) - strlen( $second ) );

		return $by_name[ $longer[0] ];
	}

	/**
	 * Published, public posts named like a candidate, or starting with the full slug.
	 *
	 * @param list<string> $candidates From slug_candidates().
	 * @return list<object{ID: int, post_name: string}>
	 */
	private static function find_posts( array $candidates ) {
		global $wpdb;

		$types = array_values( array_diff( get_post_types( [ 'public' => true ] ), [ 'attachment' ] ) );
		if ( count( $types ) === 0 ) {
			return [];
		}

		$names = implode( ',', array_fill( 0, count( $candidates ), '%s' ) );
		$type_list = implode( ',', array_fill( 0, count( $types ), '%s' ) );
		$args = array_merge( $types, $candidates, [ $wpdb->esc_like( $candidates[0] ) . '-%', self::MAX_MATCHES ] );

		/** @var list<object{ID: int, post_name: string}> $rows */
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders built above.
				"SELECT ID, post_name FROM {$wpdb->posts} WHERE post_status = 'publish' AND post_type IN ({$type_list}) AND ( post_name IN ({$names}) OR post_name LIKE %s ) ORDER BY CHAR_LENGTH(post_name) LIMIT %d",
				$args
			)
		);

		return $rows;
	}
}
