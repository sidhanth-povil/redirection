<?php

namespace Redirection\Url;

use Redirection\Core\Regex;

/**
 * Paths a redirect must never catch: redirecting them locks the team out or breaks the shop.
 * Pure (no WordPress) so it can be unit tested; the sanitizer adds shop pages and the `dsr_protected_paths` filter.
 */
class ProtectedPaths {
	const DEFAULTS = [
		'/wp-admin',
		'/wp-login.php',
		'/wp-json',
		'/xmlrpc.php',
		'/wp-cron.php',
		'/wc-api',
		'/robots.txt',
		'/sitemap.xml',
		'/sitemap_index.xml',
		'/wp-sitemap.xml',
		'/wp-comments-post.php',
		'/wp-signup.php',
		'/wp-activate.php',
		'/wp-trackback.php',
	];

	// The REST API without pretty permalinks: /?rest_route=/wp/v2/…
	const REST_QUERY = 'rest_route=';
	const REST_LABEL = '/?rest_route=';

	// Matching decodes a URL again after saving, so the check decodes until nothing changes, a few rounds at most.
	const MAX_DECODE_ROUNDS = 5;

	// Real URLs deeper inside protected paths, so a regex aimed at one of them is caught too.
	const DEEP_PROBES = [
		'/wp-admin/admin-ajax.php',
		'/wp-admin/admin-post.php',
		'/wp-admin/index.php',
		'/wp-json/wp/v2/posts',
		'/wp-admin/edit.php',
		'/wp-admin/options.php',
		'/wp-admin/plugins.php',
		'/wp-admin/post.php',
		'/wp-admin/users.php',
		'/wp-login.php?action=logout',
		'/wp-login.php?action=lostpassword',
		'/wp-login.php?action=register',
		'/wp-login.php?action=rp',
	];

	/**
	 * The first protected path the source would redirect, or null if it is safe.
	 *
	 * @param string        $source Source URL as stored.
	 * @param Regex|null    $pattern Compiled regex or wildcard source; null for a plain source.
	 * @param array<string> $protected Protected paths.
	 * @return string|null
	 */
	public static function find_blocked( $source, $pattern, array $protected ) {
		$source = self::decode( $source );

		if ( stripos( $source, self::REST_QUERY ) !== false ) {
			return self::REST_LABEL;
		}

		$path = self::normalise( (string) strtok( $source, '?' ) );

		foreach ( $protected as $item ) {
			$item = self::normalise( $item );

			if ( $pattern === null ? self::is_under( $path, $item ) : self::catches( $pattern, $item ) ) {
				return $item;
			}
		}

		return null;
	}

	/**
	 * Undo percent-encoding completely, so /wp-%256Cogin.php is checked as the /wp-login.php it ends up matching.
	 *
	 * @param string $url Source as stored.
	 * @return string
	 */
	public static function decode( $url ) {
		for ( $round = 0; $round < self::MAX_DECODE_ROUNDS; $round++ ) {
			$decoded = rawurldecode( $url );
			if ( $decoded === $url ) {
				break;
			}

			$url = $decoded;
		}

		return $url;
	}

	/**
	 * @param string $path Normalised path.
	 * @param string $item Normalised protected path.
	 * @return bool
	 */
	private static function is_under( $path, $item ) {
		return $path === $item || strpos( $path, $item . '/' ) === 0;
	}

	/**
	 * A pattern can't be compared to a path, so try it on the path itself, on paths beneath it and on known deep URLs.
	 *
	 * @param Regex  $pattern Compiled source.
	 * @param string $item Normalised protected path.
	 * @return bool
	 */
	private static function catches( Regex $pattern, $item ) {
		// ponytail: probes, not proof; a regex aimed at some other deep URL can still slip through
		$deep = array_filter(
			self::DEEP_PROBES,
			static function ( $probe ) use ( $item ) {
				return strpos( $probe, $item ) === 0;
			}
		);

		foreach ( array_merge( [ $item, $item . '/', $item . '/x', $item . '/x/y' ], $deep ) as $probe ) {
			if ( $pattern->is_match( $probe ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param string $path Path.
	 * @return string
	 */
	private static function normalise( $path ) {
		return '/' . trim( strtolower( $path ), '/' );
	}
}
