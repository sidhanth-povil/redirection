<?php
/*
Plugin Name: DSuite Redirects
Description: Manage redirects, schedule campaign redirects and catch 404s, built for marketing teams. Based on Redirection by John Godley.
Version: 1.2.0
Author: DSuite
Text Domain: dsuite-redirects
Requires PHP: 7.4
Requires at least: 6.7
Update URI: https://github.com/sidhanth-povil/redirection
License: GPLv3
============================================================================================================
For full license details see license.txt
============================================================================================================
*/

require_once __DIR__ . '/includes/core/coexistence.php';

if ( dsr_original_redirection_active( (array) get_option( 'active_plugins', [] ), is_multisite() ? (array) get_site_option( 'active_sitewide_plugins', [] ) : [] ) ) {
	add_action( 'admin_notices', 'dsr_coexistence_notice' );
	add_action( 'network_admin_notices', 'dsr_coexistence_notice' );
	return;
}

define( 'REDIRECTION_DB_VERSION', '4.2' );     // DB schema version. Only change if DB needs changing
define( 'REDIRECTION_FILE', __FILE__ );
define( 'REDIRECTION_VERSION', '1.2.0' );
define( 'REDIRECTION_MIN_WP', '6.6' );

if ( ! defined( 'REDIRECTION_FLYING_SOLO' ) ) {
	define( 'REDIRECTION_FLYING_SOLO', apply_filters( 'redirection_flying_solo', true ) );
}

// This file must support PHP < 7.4 so as not to crash
if ( version_compare( phpversion(), '7.4' ) < 0 ) {
	add_filter( 'plugin_action_links_' . basename( dirname( REDIRECTION_FILE ) ) . '/' . basename( REDIRECTION_FILE ), 'red_deprecated_php' );

	/**
	 * @param array<string> $links
	 * @return array<string>
	 */
	function red_deprecated_php( array $links ): array {
		/* translators: 1: server PHP version. 2: required PHP version. */
		array_unshift( $links, '<span style="color: red">' . sprintf( __( 'Disabled! Detected PHP %1$s, need PHP %2$s+', 'dsuite-redirects' ), phpversion(), '7.4' ) . '</span>' );
		return $links;
	}

	return;
}

require_once __DIR__ . '/redirection-load.php';
