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

	/**
	 * Changes every hour, so a token seen once (a proxy log, an intercepted test) soon stops hiding visits.
	 *
	 * @param int|null $time Time to make the token for; now by default.
	 * @return string
	 */
	public static function token( $time = null ) {
		$window = (int) floor( ( $time ?? time() ) / HOUR_IN_SECONDS );

		return wp_hash( 'dsr-redirect-test|' . $window );
	}

	/**
	 * This hour's or the last hour's token, so a test made at the turn of the hour still counts.
	 *
	 * @param string $sent Token from the request.
	 * @return bool
	 */
	public static function is_valid_token( $sent ) {
		return $sent !== '' && ( hash_equals( self::token(), $sent ) || hash_equals( self::token( time() - HOUR_IN_SECONDS ), $sent ) );
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

		$code = (int) wp_remote_retrieve_response_code( $response );
		$header = wp_remote_retrieve_header( $response, 'location' );
		// A response may repeat the header; the first one is where browsers go.
		$location = self::relative( is_array( $header ) ? (string) ( $header[0] ?? '' ) : $header );

		return [
			'code' => $code,
			'location' => $location,
			'ms' => $ms,
			'utm_preserved' => $passes_query && $location !== '' ? strpos( $location, self::UTM_KEY . '=' . self::UTM_VALUE ) !== false : null,
			'ok' => self::is_expected( $item, $code, $location ),
		];
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
