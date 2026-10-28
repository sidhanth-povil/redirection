<?php

namespace Redirection\Plugin;

/**
 * Updates from the plugin's GitHub releases. The Update URI header points at github.com, so WordPress asks the
 * update_plugins_github.com filter instead of wordpress.org, and shows the result as a normal dashboard update.
 *
 * Releases are found through github.com's own redirects rather than the GitHub API. The API allows 60 requests an hour
 * per server address, which sites on shared hosting run out of, and then nobody hears about updates.
 */
class Updater {
	const REPOSITORY = 'sidhanth-povil/redirection';
	const RELEASES = 'https://github.com/' . self::REPOSITORY . '/releases/';
	// Redirects to releases/tag/<latest tag>
	const LATEST_URL = self::RELEASES . 'latest';
	const ASSET_NAME = 'dsuite-redirects.zip';
	const CACHE_KEY = 'dsr_github_release';

	const CACHE_SECONDS = 12 * HOUR_IN_SECONDS;
	const RETRY_SECONDS = HOUR_IN_SECONDS;
	const TIMEOUT = 10;

	/**
	 * @param array<string, mixed>|false $update Update data from an earlier filter, or false.
	 * @param array<string, mixed>       $plugin_data Plugin headers.
	 * @param string                     $plugin_file Plugin basename.
	 * @return array<string, mixed>|false
	 */
	public static function check( $update, $plugin_data, $plugin_file ) {
		if ( $plugin_file !== plugin_basename( REDIRECTION_FILE ) ) {
			return $update;
		}

		$release = self::get_cached_release();
		if ( ! isset( $release['version'] ) ) {
			return $update;
		}

		return [
			'id' => 'github.com/' . self::REPOSITORY,
			'slug' => dirname( $plugin_file ),
			'plugin' => $plugin_file,
			// Shown beside the update on Dashboard > Updates
			'icons' => [
				'1x' => plugins_url( 'assets/icon-128x128.png', REDIRECTION_FILE ),
				'2x' => plugins_url( 'assets/icon-256x256.png', REDIRECTION_FILE ),
			],
		] + $release;
	}

	/**
	 * Details for the dashboard's "View version details" link, which would otherwise ask wordpress.org.
	 *
	 * @param false|object|array<string, mixed> $result Result from an earlier filter.
	 * @param string                            $action plugins_api action.
	 * @param object                            $args Request arguments.
	 * @return false|object|array<string, mixed>
	 */
	public static function details( $result, $action, $args ) {
		if ( $action !== 'plugin_information' || ! isset( $args->slug ) || $args->slug !== dirname( plugin_basename( REDIRECTION_FILE ) ) ) {
			return $result;
		}

		$release = self::get_cached_release();
		if ( ! isset( $release['version'] ) ) {
			return $result;
		}

		return (object) [
			'name' => 'DSuite Redirects',
			'slug' => $args->slug,
			'version' => $release['version'],
			'homepage' => 'https://github.com/' . self::REPOSITORY,
			'download_link' => $release['package'],
			'sections' => [
				'changelog' => sprintf(
					'<p><a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a></p>',
					esc_url( $release['url'] ),
					/* translators: %s: version number */
					esc_html( sprintf( __( 'What changed in %s', 'dsuite-redirects' ), $release['version'] ) )
				),
			],
		];
	}

	/**
	 * Says on the Plugins page when the last update check failed, instead of quietly reporting no update.
	 *
	 * @param list<string> $meta Row links.
	 * @param string       $plugin_file Plugin basename.
	 * @return list<string>
	 */
	public static function row_meta( $meta, $plugin_file ) {
		if ( $plugin_file !== plugin_basename( REDIRECTION_FILE ) || ! current_user_can( 'update_plugins' ) ) {
			return $meta;
		}

		$release = get_site_transient( self::CACHE_KEY );
		if ( ! is_array( $release ) || ! isset( $release['error'] ) ) {
			return $meta;
		}

		$meta[] = sprintf(
			'<span style="color:#b32d2e">%s</span>',
			/* translators: %s: why the check failed */
			esc_html( sprintf( __( 'Update check failed: %s. Dashboard > Updates > Check again retries.', 'dsuite-redirects' ), (string) $release['error'] ) )
		);

		return $meta;
	}

	/**
	 * Forget the cached release when WordPress forgets its update data, as it does after installing or activating plugins.
	 *
	 * @return void
	 */
	public static function clear() {
		delete_site_transient( self::CACHE_KEY );
	}

	/**
	 * Dashboard > Updates > Check again only reloads the page with force-check=1 and keeps WordPress's update data,
	 * so forget the cached release before WordPress asks for updates on that page.
	 *
	 * @return void
	 */
	public static function force_check() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- core's own read-only "Check again" link.
		if ( ! empty( $_GET['force-check'] ) ) {
			self::clear();
		}
	}

	/**
	 * @return array{version: string, url: string, package: string}|array{error: string}
	 */
	private static function get_cached_release() {
		$release = get_site_transient( self::CACHE_KEY );

		if ( ! is_array( $release ) || ( ! isset( $release['version'] ) && ! isset( $release['error'] ) ) ) {
			$release = self::get_release();
			// A failed check is cached too, so an outage doesn't send a request on every page
			set_site_transient( self::CACHE_KEY, $release, isset( $release['error'] ) ? self::RETRY_SECONDS : self::CACHE_SECONDS );
		}

		/** @var array{version: string, url: string, package: string}|array{error: string} $release */
		return $release;
	}

	/**
	 * The latest release with its zip, or why there isn't a usable one.
	 *
	 * @return array{version: string, url: string, package: string}|array{error: string}
	 */
	private static function get_release() {
		$latest = self::head( self::LATEST_URL );
		if ( is_string( $latest ) ) {
			return [ 'error' => $latest ];
		}

		// Only this repository's releases are ever followed
		$tag = '';
		if ( preg_match( '#^' . preg_quote( self::RELEASES, '#' ) . 'tag/([^/?\#]+)$#', $latest['location'], $matches ) === 1 ) {
			$tag = rawurldecode( $matches[1] );
		}

		$version = ltrim( $tag, 'v' );
		if ( preg_match( '/^\d+(\.\d+)*$/', $version ) !== 1 ) {
			/* translators: %s: where GitHub pointed */
			return [ 'error' => sprintf( __( 'GitHub did not point to a release (%s)', 'dsuite-redirects' ), $latest['location'] ) ];
		}

		$package = self::RELEASES . 'download/' . rawurlencode( $tag ) . '/' . self::ASSET_NAME;
		$zip = self::head( $package );
		if ( is_string( $zip ) ) {
			/* translators: 1: zip file name, 2: version tag */
			return [ 'error' => sprintf( __( 'release %2$s has no %1$s', 'dsuite-redirects' ), self::ASSET_NAME, $tag ) ];
		}

		return [
			'version' => $version,
			'url' => self::RELEASES . 'tag/' . rawurlencode( $tag ),
			'package' => $package,
		];
	}

	/**
	 * A github.com address that should redirect: where to, or why it didn't.
	 *
	 * @param string $url Address on github.com.
	 * @return array{location: string}|string
	 */
	private static function head( $url ) {
		$response = wp_safe_remote_head(
			$url,
			[
				'timeout' => self::TIMEOUT,
				'redirection' => 0,
			]
		);

		if ( is_wp_error( $response ) ) {
			return $response->get_error_message();
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$location = wp_remote_retrieve_header( $response, 'location' );
		$location = is_array( $location ) ? (string) end( $location ) : $location;

		if ( $code < 300 || $code > 399 || $location === '' ) {
			/* translators: %d: HTTP status code */
			return sprintf( __( 'GitHub answered %d', 'dsuite-redirects' ), $code );
		}

		return [ 'location' => $location ];
	}
}
