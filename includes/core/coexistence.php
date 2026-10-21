<?php
/**
 * Coexistence guard with the original Redirection plugin.
 *
 * Both plugins declare the same global functions and constants, so loading both is fatal.
 * The main plugin file requires this before declaring anything and returns early when
 * the original is active. Keep this file free of any other code or declarations.
 */

const DSR_ORIGINAL_BASENAME = 'redirection/redirection.php';

/**
 * @param array<int, string>        $active_plugins  Site `active_plugins` option.
 * @param array<string, int|string> $network_plugins Network `active_sitewide_plugins` option.
 */
function dsr_original_redirection_active( array $active_plugins, array $network_plugins ): bool {
	return in_array( DSR_ORIGINAL_BASENAME, $active_plugins, true ) || array_key_exists( DSR_ORIGINAL_BASENAME, $network_plugins );
}

function dsr_coexistence_notice(): void {
	echo '<div class="notice notice-error"><p>' . esc_html__( 'DSuite Redirects is paused. Deactivate the Redirection plugin to use it. Your redirects will carry over.', 'dsuite-redirects' ) . '</p></div>';
}
