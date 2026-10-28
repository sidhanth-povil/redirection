<?php

namespace Redirection\Plugin;

/**
 * Updates from the plugin's GitHub releases. The Update URI header points at github.com, so WordPress asks the
 * update_plugins_github.com filter instead of wordpress.org, and shows the result as a normal dashboard update.
 */
class Updater {
	const REPOSITORY = 'sidhanth-povil/redirection';
	const RELEASE_API = 'https://api.github.com/repos/' . self::REPOSITORY . '/releases/latest';
	const ASSET_NAME = 'dsuite-redirects.zip';
	const CACHE_KEY = 'dsr_github_release';

	// GitHub allows 60 unauthenticated API requests an hour per address
	const CACHE_SECONDS = 12 * HOUR_IN_SECONDS;
	const RETRY_SECONDS = HOUR_IN_SECONDS;

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
		if ( $release === [] ) {
			return $update;
		}

		return [
			'id' => 'github.com/' . self::REPOSITORY,
			'slug' => dirname( $plugin_file ),
			'plugin' => $plugin_file,
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
		if ( $release === [] ) {
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
	 * @return array{version: string, url: string, package: string}|array{}
	 */
	private static function get_cached_release() {
		$release = get_site_transient( self::CACHE_KEY );

		if ( ! is_array( $release ) ) {
			$release = self::get_release();
			// An empty array caches a failed check, so an outage doesn't send a request on every page
			set_site_transient( self::CACHE_KEY, $release, $release === [] ? self::RETRY_SECONDS : self::CACHE_SECONDS );
		}

		/** @var array{version: string, url: string, package: string}|array{} $release */
		return $release;
	}

	/**
	 * The latest release, or an empty array when there isn't a usable one.
	 *
	 * @return array{version: string, url: string, package: string}|array{}
	 */
	private static function get_release() {
		$response = wp_safe_remote_get(
			self::RELEASE_API,
			[
				'timeout' => 10,
				'headers' => [ 'Accept' => 'application/vnd.github+json' ],
			]
		);

		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
			return [];
		}

		$json = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $json ) || ! isset( $json['tag_name'], $json['assets'] ) || ! is_array( $json['assets'] ) ) {
			return [];
		}

		$version = ltrim( (string) $json['tag_name'], 'v' );
		if ( preg_match( '/^\d+(\.\d+)*$/', $version ) !== 1 ) {
			return [];
		}

		// Only this repository's own release download is ever installed
		$prefix = 'https://github.com/' . self::REPOSITORY . '/releases/download/';

		foreach ( $json['assets'] as $asset ) {
			if ( ! is_array( $asset ) || ! isset( $asset['name'], $asset['browser_download_url'] ) ) {
				continue;
			}

			$url = (string) $asset['browser_download_url'];

			if ( $asset['name'] === self::ASSET_NAME && strpos( $url, $prefix ) === 0 ) {
				return [
					'version' => $version,
					'url' => 'https://github.com/' . self::REPOSITORY . '/releases/tag/' . rawurlencode( (string) $json['tag_name'] ),
					'package' => $url,
				];
			}
		}

		return [];
	}
}
