<?php

namespace Redirection\Module;

use Redirection\ImportExport\Htaccess;
use Redirection\Redirect\Redirect;
use WP_Error;

/**
 * @phpstan-import-type RedModuleOptions from Module
 */
class Apache extends Module {
	const MODULE_ID = 2;

	/**
	 * Location path for .htaccess file
	 *
	 * @var string
	 */
	private $location = '';

	/**
	 * Get module ID
	 *
	 * @return int
	 */
	public function get_id() {
		return self::MODULE_ID;
	}

	/**
	 * Get module name
	 *
	 * @return string
	 */
	public function get_name() {
		return 'Apache';
	}

	/**
	 * Get .htaccess file location
	 *
	 * @return string
	 */
	public function get_location() {
		return $this->location;
	}

	/**
	 * Load module data
	 *
	 * @param array $options Options.
	 * @phpstan-param RedModuleOptions $options
	 * @return void
	 */
	protected function load( array $options ) {
		if ( isset( $options['location'] ) ) {
			$this->location = $options['location'];
		}
	}

	/**
	 * Flush module by regenerating .htaccess file
	 *
	 * @return bool
	 */
	protected function flush_module() {
		if ( empty( $this->location ) || is_wp_error( $this->is_allowed_location( $this->location ) ) ) {
			return false;
		}

		$items = Redirect::get_all_for_module( $this->get_id() );

		// Produce the .htaccess file
		$htaccess = new Htaccess();
		if ( count( $items ) > 0 ) {
			foreach ( $items as $item ) {
				if ( $item->is_enabled() ) {
					$htaccess->add( $this->get_legacy_htaccess_item( $item ) );
				}
			}
		}

		return $htaccess->save( $this->location );
	}

	/**
	 * Convert a refactored redirect to the legacy item expected by Htaccess.
	 *
	 * Remove this once the Htaccess exporter accepts Redirection\Redirect\Redirect.
	 *
	 * @param Redirect $item Redirect.
	 * @return \Red_Item
	 */
	private function get_legacy_htaccess_item( Redirect $item ) {
		$match_data = $item->get_match_data();
		$match_data_json = '';

		if ( $match_data !== null ) {
			$encoded = wp_json_encode( $match_data, JSON_UNESCAPED_SLASHES );
			$match_data_json = is_string( $encoded ) ? $encoded : '';
		}

		return new \Red_Item(
			[
				'id' => $item->get_id(),
				'url' => $item->get_url(),
				'match_url' => $item->get_match_url(),
				'match_data' => $match_data_json,
				'regex' => $item->is_regex(),
				'action_data' => $item->get_action_data(),
				'action_code' => $item->get_action_code(),
				'action_type' => $item->get_action_type(),
				'match_type' => $item->get_match_type(),
				'title' => $item->get_title(),
				'last_access' => $item->get_last_hit(),
				'last_count' => $item->get_hits(),
				'status' => $item->is_enabled() ? 'enabled' : 'disabled',
				'position' => $item->get_position(),
				'group_id' => $item->get_group_id(),
			]
		);
	}

	/**
	 * Check if .htaccess file can be saved to the given location
	 *
	 * @param string $location File path.
	 * @return WP_Error|true
	 */
	public function can_save( $location ) {
		$location = $this->sanitize_location( $location );

		$file = fopen( $location, 'a' );
		if ( $file === false ) {
			$error = error_get_last();
			return new WP_Error( 'redirect', $error['message'] ?? 'Unknown error' );
		}

		fclose( $file );
		return true;
	}

	/**
	 * Is the .htaccess location a local path inside the site? Anything else lets the location write server config
	 * elsewhere, and a stream wrapper such as phar:// reaches the filesystem functions.
	 *
	 * @param string $location File path.
	 * @return WP_Error|true
	 */
	public function is_allowed_location( $location ) {
		$location = $this->sanitize_location( $location );

		if ( strpos( $location, '://' ) !== false ) {
			return new WP_Error( 'redirect', __( 'The .htaccess location must be a local path.', 'dsuite-redirects' ) );
		}

		if ( ! function_exists( 'get_home_path' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		// A .htaccess that is itself a link would be written wherever it points
		if ( is_link( $location ) ) {
			return new WP_Error( 'redirect', __( 'The .htaccess location must not be a link.', 'dsuite-redirects' ) );
		}

		$dir = realpath( dirname( $location ) );
		$roots = array_filter( [ realpath( get_home_path() ), realpath( ABSPATH ) ] );

		foreach ( $roots as $root ) {
			if ( $dir !== false && strpos( trailingslashit( $dir ), trailingslashit( $root ) ) === 0 ) {
				return true;
			}
		}

		return new WP_Error( 'redirect', __( 'The .htaccess location must be inside the site directory.', 'dsuite-redirects' ) );
	}

	/**
	 * Can the current user change the .htaccess location? On multisite a site administrator has no file rights.
	 *
	 * @return WP_Error|true
	 */
	public function can_change_location() {
		if ( is_multisite() && ! current_user_can( 'manage_network_options' ) && ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return new WP_Error( 'redirect', __( 'Only a network administrator can change the .htaccess location.', 'dsuite-redirects' ) );
		}

		return true;
	}

	/**
	 * Sanitize location path to ensure it ends with .htaccess
	 *
	 * @param string $location File path.
	 * @return string
	 */
	private function sanitize_location( $location ) {
		$location = str_replace( '.htaccess', '', $location );
		$location = rtrim( $location, '/' ) . '/.htaccess';
		return rtrim( dirname( $location ), '/' ) . '/.htaccess';
	}

	/**
	 * Update module configuration
	 *
	 * @param array $data Data.
	 * @phpstan-param RedModuleOptions $data
	 * @return array<string, string>|false
	 */
	public function update( array $data ) {
		$new_location = $data['location'] ?? '';
		if ( strlen( $new_location ) > 0 ) {
			$new_location = $this->sanitize_location( trim( $new_location ) );
		}

		// A refused location leaves the current one in place
		if ( is_wp_error( $this->can_change_location() ) || ( $new_location !== '' && is_wp_error( $this->is_allowed_location( $new_location ) ) ) ) {
			return [
				'location' => $this->location,
			];
		}

		$save = [
			'location' => $new_location,
		];

		if ( ! empty( $this->location ) && $save['location'] !== $this->location && $save['location'] !== '' && $this->is_allowed_location( $this->location ) === true ) {
			// Location has moved. Remove from old location
			$htaccess = new Htaccess();
			$htaccess->save( $this->location, false );
		}

		$this->load( $save );

		if ( $save['location'] !== '' && $this->flush_module() === false ) {
			$save['location'] = '';
		}

		return $save;
	}
}
