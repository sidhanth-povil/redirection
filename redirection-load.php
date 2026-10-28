<?php
/**
 * Plugin bootstrap. Loaded by dsuite-redirects.php only after the coexistence guard passes:
 * PHP binds these top-level functions at compile time, so they must not live in the main file.
 */

dsr_forget_original_uninstall();

/**
 * Autoload a namespaced class from a plugin directory.
 *
 * @param string $requested_class Requested class name.
 * @param string $prefix Namespace prefix.
 * @param string $base_dir Base directory.
 * @return void
 */
function redirection_autoload_namespace( $requested_class, $prefix, $base_dir ) {
	if ( strncmp( $prefix, $requested_class, strlen( $prefix ) ) !== 0 ) {
		return;
	}

	$relative_class = substr( $requested_class, strlen( $prefix ) );
	if ( $relative_class === '' ) {
		return;
	}

	$normalize = static function ( $value ) {
		$value = preg_replace( '/(?<!^)[A-Z]/', '-$0', $value );

		if ( ! is_string( $value ) ) {
			return '';
		}

		return str_replace( '_', '-', strtolower( $value ) );
	};

	$segments = explode( '\\', $relative_class );
	$class_name = array_pop( $segments );
	if ( ! is_string( $class_name ) || $class_name === '' ) {
		return;
	}

	if ( count( $segments ) > 0 ) {
		$base_dir .= implode( '/', array_map( $normalize, $segments ) ) . '/';
	}

	$path = $base_dir . 'class-' . $normalize( $class_name ) . '.php';

	if ( file_exists( $path ) ) {
		require_once $path;
	}
}

/**
 * Autoload namespaced Redirection classes from the includes directory.
 *
 * @param string $requested_class Requested class name.
 * @return void
 */
function redirection_autoload( $requested_class ) {
	redirection_autoload_namespace( $requested_class, 'Redirection\\', __DIR__ . '/includes/' );
}

spl_autoload_register( 'redirection_autoload' );

/**
 * Refactor mode - using autoloading for all classes under includes/ - is now the only supported
 * runtime mode. The REDIRECTION_REFACTOR constant is no longer read. The pre-refactor files
 * (models/, redirection-admin.php, redirection-front.php, redirection-cli.php,
 * redirection-settings.php) are left in place for reference but are no longer reachable.
 *
 * @return bool
 */
function red_is_refactor_enabled() {
	return true;
}

if ( red_is_refactor_enabled() ) {
	require_once __DIR__ . '/redirection-refactor.php';
} else {
	require_once __DIR__ . '/redirection-settings.php';
	require_once __DIR__ . '/models/options.php';
	require_once __DIR__ . '/models/redirect/redirect.php';
	require_once __DIR__ . '/models/url/url.php';
	require_once __DIR__ . '/models/regex.php';
	require_once __DIR__ . '/models/module.php';
	require_once __DIR__ . '/models/log/log.php';
	require_once __DIR__ . '/models/flusher.php';
	require_once __DIR__ . '/models/match.php';
	require_once __DIR__ . '/models/action.php';
	require_once __DIR__ . '/models/request.php';
	require_once __DIR__ . '/models/header.php';
	require_once __DIR__ . '/models/group.php';
}

/**
 * Clear PHP opcache when plugin is updated. This is to help with mid-update errors.
 *
 * @param object $upgrader The upgrader object.
 * @param array{action: string, type: string, plugin?: string, plugins?: string[]} $options The upgrade options.
 * @return void
 */
function redirection_clear_opcache_on_upgrade( $upgrader, $options ) {
	if ( $options['action'] !== 'update' || $options['type'] !== 'plugin' ) {
		return;
	}

	$plugin_basename = plugin_basename( REDIRECTION_FILE );
	$plugins = isset( $options['plugins'] ) && is_array( $options['plugins'] ) ? $options['plugins'] : [];

	if ( isset( $options['plugin'] ) && is_string( $options['plugin'] ) ) {
		$plugins[] = $options['plugin'];
	}

	if ( ! in_array( $plugin_basename, $plugins, true ) ) {
		return;
	}

	if ( function_exists( 'opcache_reset' ) ) {
		// Suppress warnings if opcache_reset is restricted by server configuration
		@opcache_reset(); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
	}
}

add_action( 'upgrader_process_complete', 'redirection_clear_opcache_on_upgrade', 10, 2 );

// Updates come from GitHub releases (see the Update URI header)
add_filter( 'update_plugins_github.com', [ Redirection\Plugin\Updater::class, 'check' ], 10, 3 );
add_filter( 'plugins_api', [ Redirection\Plugin\Updater::class, 'details' ], 10, 3 );
add_action( 'delete_site_transient_update_plugins', [ Redirection\Plugin\Updater::class, 'clear' ] );
// Before wp_update_plugins (priority 10) runs on the same hook
add_action( 'load-update-core.php', [ Redirection\Plugin\Updater::class, 'force_check' ], 9 );

// Everywhere, not only in the admin: the block editor trashes and deletes posts through the REST API
add_action( 'wp_trash_post', [ Redirection\Plugin\TrashNotice::class, 'remember' ] );
add_action( 'before_delete_post', [ Redirection\Plugin\TrashNotice::class, 'remember' ] );
add_action( 'untrashed_post', [ Redirection\Plugin\TrashNotice::class, 'forget' ] );

/**
 * @return bool
 */
function red_is_wpcli() {
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		return true;
	}

	return false;
}

/**
 * Detect a plain PHP CLI context (e.g., a cron script that loads wp-load.php
 * directly). Distinct from red_is_wpcli(), which is only true under WP-CLI.
 * Used to skip front-end redirect enforcement that would otherwise call die()
 * and silently terminate the CLI process.
 *
 * @return bool
 */
function red_is_cli() {
	return PHP_SAPI === 'cli';
}

/**
 * @return bool
 */
function red_is_admin() {
	if ( is_admin() ) {
		return true;
	}

	return false;
}

/**
 * @return void
 */
function red_start_rest() {
	if ( red_is_refactor_enabled() ) {
		Redirection\Api\Api::init();
		Redirection\Plugin\Admin::init();
		remove_action( 'rest_api_init', 'red_start_rest' );
		return;
	}

	require_once __DIR__ . '/redirection-admin.php';
	Redirection\Api\Api::init();
	Redirection_Admin::init();

	remove_action( 'rest_api_init', 'red_start_rest' );
}

/**
 * @return void
 */
function redirection_locale() {
	load_plugin_textdomain( 'dsuite-redirects', false, dirname( plugin_basename( REDIRECTION_FILE ) ) . '/locale/' );
}

if ( red_is_refactor_enabled() ) {
	if ( red_is_admin() || red_is_wpcli() ) {
		register_activation_hook( REDIRECTION_FILE, [ Redirection\Plugin\Admin::class, 'plugin_activated' ] );

		// @phpstan-ignore return.void
		add_action( 'init', [ Redirection\Plugin\Admin::class, 'init' ] );
	} else {
		// @phpstan-ignore return.void
		add_action( 'plugins_loaded', [ Redirection\Plugin\Front::class, 'init' ] );
	}

	if ( red_is_wpcli() ) {
		WP_CLI::add_command( 'redirection', Redirection\Plugin\Cli::class );

		add_action(
			Redirection\Plugin\Flusher::DELETE_HOOK,
			function () {
				$flusher = new Redirection\Plugin\Flusher();
				$flusher->flush();
			}
		);
		add_action(
			Redirection\Alerts\Digest::HOOK,
			function () {
				Redirection\Alerts\Digest::run();
			}
		);
	}
} elseif ( red_is_admin() || red_is_wpcli() ) {
	require_once __DIR__ . '/redirection-admin.php';
} else {
	require_once __DIR__ . '/redirection-front.php';
}

if ( ! red_is_refactor_enabled() && red_is_wpcli() ) {
	require_once __DIR__ . '/redirection-cli.php';
}

add_action( 'rest_api_init', 'red_start_rest' );
add_action( 'init', 'redirection_locale' );
