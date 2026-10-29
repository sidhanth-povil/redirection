<?php

namespace Redirection\Redirect;

use WP_Error;

/**
 * Tests a saved redirect from the server, so a marketer's browser never caches a 301 they are about to change.
 * The request carries a secret header so the test doesn't count as a hit or show in the log.
 */
class Tester {
	const HEADER = 'X-DSR-Test';
	const TIMEOUT = 5;
	const UTM_KEY = 'utm_source';
	const UTM_VALUE = 'dsr-test';
	// A test takes seconds; a short window means a token seen once (a proxy log, say) soon stops hiding visits.
	const TOKEN_WINDOW = 10 * MINUTE_IN_SECONDS;
	// Browsers give up around 20 hops; a chain of 10 on one site is already a problem worth showing.
	const MAX_HOPS = 10;

	/**
	 * Changes every TOKEN_WINDOW.
	 *
	 * @param int|null $time Time to make the token for; now by default.
	 * @return string
	 */
	public static function token( $time = null ) {
		$window = (int) floor( ( $time ?? time() ) / self::TOKEN_WINDOW );

		return wp_hash( 'dsr-redirect-test|' . $window );
	}

	/**
	 * This window's or the last one's token, so a test made at the turn of a window still counts.
	 *
	 * @param string $sent Token from the request.
	 * @return bool
	 */
	public static function is_valid_token( $sent ) {
		return $sent !== '' && ( hash_equals( self::token(), $sent ) || hash_equals( self::token( time() - self::TOKEN_WINDOW ), $sent ) );
	}

	/**
	 * Is the current request one of our own tests?
	 *
	 * @return bool
	 */
	public static function is_test_request() {
		$sent = isset( $_SERVER['HTTP_X_DSR_TEST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_DSR_TEST'] ) ) : '';

		return self::is_valid_token( $sent );
	}

	/**
	 * Request the redirect's old URL without following it and report what came back.
	 *
	 * @param Redirect $item Redirect.
	 * @return array{code: int, location: string, ms: int, utm_preserved: bool|null, ok: bool}|WP_Error
	 */
	public static function run( Redirect $item ) {
		if ( ! self::can_test( $item ) ) {
			return new WP_Error( 'redirect_test', __( 'Only a redirect from one exact address to a page, or a Gone redirect, can be tested.', 'dsuite-redirects' ), [ 'status' => 400 ] );
		}

		// An extra parameter would stop an exact redirect matching, so tracking is only checked when it is passed on.
		$passes_query = self::passes_query( $item );
		$url = self::origin() . $item->get_url();
		if ( $passes_query ) {
			$url = add_query_arg( self::UTM_KEY, self::UTM_VALUE, $url );
		}

		$response = self::request( $url );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		[ 'code' => $code, 'location' => $location, 'ms' => $ms ] = $response;

		return [
			'code' => $code,
			'location' => $location,
			'ms' => $ms,
			'utm_preserved' => $passes_query && $location !== '' ? strpos( $location, self::UTM_KEY . '=' . self::UTM_VALUE ) !== false : null,
			'ok' => self::is_expected( $item, $code, $location ),
		];
	}

	/**
	 * Follow an address on this site hop by hop, as a visitor would, without the browser cache getting in the way.
	 * Only this site is ever requested: a hop to another site is reported, not followed.
	 *
	 * @param string $url Full URL on this site, or a path.
	 * @return array{hops: list<array{url: string, code: int, location: string, external: bool, ms: int}>, loop: bool}|WP_Error
	 */
	public static function trace( $url ) {
		$path = self::own_path( trim( $url ) );
		if ( $path === null ) {
			return new WP_Error( 'redirect_trace', __( 'Only addresses on this site can be checked.', 'dsuite-redirects' ), [ 'status' => 400 ] );
		}

		$hops = [];
		$seen = [];
		$loop = false;

		for ( $hop = 0; $hop < self::MAX_HOPS; $hop++ ) {
			if ( isset( $seen[ $path ] ) ) {
				$loop = true;
				break;
			}
			$seen[ $path ] = true;

			$response = self::request( self::origin() . $path );
			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$is_redirect = $response['code'] >= 300 && $response['code'] < 400 && $response['location'] !== '';
			$next = $is_redirect ? self::own_path( $response['location'] ) : null;
			$hops[] = [
				'url' => $path,
				'code' => $response['code'],
				'location' => $response['location'],
				'external' => $is_redirect && $next === null,
				'ms' => $response['ms'],
			];

			if ( $next === null ) {
				break;
			}

			$path = $next;
		}

		return [
			'hops' => $hops,
			'loop' => $loop,
		];
	}

	/**
	 * One request to this site, not following any redirect. Carries the test header so it isn't counted as a hit.
	 *
	 * @param string $url Full URL on this site.
	 * @return array{code: int, location: string, ms: int}|WP_Error
	 */
	private static function request( $url ) {
		$start = microtime( true );
		$response = wp_remote_get(
			$url,
			[
				'redirection' => 0,
				'timeout' => self::TIMEOUT,
				// Same as WordPress core's own loopback requests: local certificates are often self-signed.
				'sslverify' => apply_filters( 'https_local_ssl_verify', false ),
				'limit_response_size' => 1024,
				'headers' => [
					self::HEADER => self::token(),
					'Cache-Control' => 'no-cache',
					'Pragma' => 'no-cache',
				],
			]
		);
		$ms = (int) round( ( microtime( true ) - $start ) * 1000 );

		if ( is_wp_error( $response ) ) {
			/* translators: %s: error message from the HTTP request */
			return new WP_Error( 'redirect_test_failed', sprintf( __( 'Your site could not reach itself to run the test: %s', 'dsuite-redirects' ), $response->get_error_message() ), [ 'status' => 502 ] );
		}

		$header = wp_remote_retrieve_header( $response, 'location' );

		return [
			'code' => (int) wp_remote_retrieve_response_code( $response ),
			// A response may repeat the header; the first one is where browsers go.
			'location' => self::relative( is_array( $header ) ? (string) ( $header[0] ?? '' ) : $header ),
			'ms' => $ms,
		];
	}

	/**
	 * The path and query of a URL on this site, or null for anything else. A path must start with one slash, so it
	 * can't name another host once appended to this site's origin.
	 *
	 * @param string $url URL or path.
	 * @return string|null
	 */
	private static function own_path( $url ) {
		if ( strpos( $url, '/' ) === 0 ) {
			return strpos( $url, '//' ) === 0 ? null : $url;
		}

		$parts = wp_parse_url( $url );
		$home = wp_parse_url( home_url() );
		if ( ! is_array( $parts ) || ! is_array( $home ) || ! in_array( $parts['scheme'] ?? '', [ 'http', 'https' ], true ) ) {
			return null;
		}

		$same_host = strtolower( $parts['host'] ?? '' ) === strtolower( $home['host'] ?? '' ) && ( $parts['port'] ?? null ) === ( $home['port'] ?? null );
		if ( ! $same_host ) {
			return null;
		}

		return ( $parts['path'] ?? '/' ) . ( isset( $parts['query'] ) ? '?' . $parts['query'] : '' );
	}

	/**
	 * Only a plain address can be requested; a wildcard, regex or condition has no single URL to try.
	 *
	 * @param Redirect $item Redirect.
	 * @return bool
	 */
	private static function can_test( Redirect $item ) {
		// The path is appended to this site's origin, so anything but a leading slash could name another host.
		return $item->get_match_type() === 'url'
			&& strpos( $item->get_url(), '/' ) === 0
			&& strpos( $item->get_url(), '//' ) !== 0
			&& ! $item->is_regex()
			&& in_array( $item->get_action_type(), [ 'url', 'error' ], true );
	}

	/**
	 * @param Redirect $item Redirect.
	 * @return bool
	 */
	private static function passes_query( Redirect $item ) {
		$match_data = $item->get_match_data();

		return isset( $match_data['source']['flag_query'] ) && $match_data['source']['flag_query'] === 'pass';
	}

	/**
	 * @param Redirect $item Redirect.
	 * @param int      $code Response code.
	 * @param string   $location Location header, relative when on this site.
	 * @return bool
	 */
	private static function is_expected( Redirect $item, $code, $location ) {
		if ( $code !== $item->get_action_code() ) {
			return false;
		}

		if ( $item->get_action_type() !== 'url' ) {
			return true;
		}

		return self::page_of( $location ) === self::page_of( self::relative( (string) $item->get_action_data() ) );
	}

	/**
	 * Host and path, ignoring the query (passed-on tracking) and a trailing slash.
	 *
	 * @param string $url URL.
	 * @return string
	 */
	private static function page_of( $url ) {
		$parts = wp_parse_url( $url );
		$host = is_array( $parts ) && isset( $parts['host'] ) ? strtolower( $parts['host'] ) : '';
		$path = is_array( $parts ) && isset( $parts['path'] ) ? $parts['path'] : '';

		return $host . untrailingslashit( $path );
	}

	/**
	 * Sources are paths from the domain root (as in REQUEST_URI), so tests start from the scheme and host only.
	 *
	 * @return string
	 */
	private static function origin() {
		$home = wp_parse_url( home_url() );
		$scheme = is_array( $home ) && isset( $home['scheme'] ) ? $home['scheme'] : 'http';
		$host = is_array( $home ) && isset( $home['host'] ) ? $home['host'] : '';
		$port = is_array( $home ) && isset( $home['port'] ) ? ':' . $home['port'] : '';

		return $scheme . '://' . $host . $port;
	}

	/**
	 * @param string $url URL.
	 * @return string The URL without this site's origin.
	 */
	private static function relative( $url ) {
		$origin = self::origin();

		return stripos( $url, $origin . '/' ) === 0 ? substr( $url, strlen( $origin ) ) : $url;
	}
}
