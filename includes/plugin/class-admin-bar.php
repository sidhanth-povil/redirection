<?php

namespace Redirection\Plugin;

use Redirection\Core\Capabilities;

/**
 * A front-end admin bar link: on a page it opens a new redirect pointing at that page (a campaign shortlink),
 * on a 404 it opens one from the broken address. The drawer itself lives in the plugin page, so the front end
 * loads nothing extra.
 */
class AdminBar {
	const NODE_ID = 'dsr-redirect';

	/**
	 * @param \WP_Admin_Bar $bar Admin bar.
	 * @return void
	 */
	public static function add_node( $bar ) {
		if ( is_admin() || ! Capabilities::has_access( Capabilities::CAP_REDIRECT_ADD ) ) {
			return;
		}

		// Path only: the redirect keeps working after a staging → live move, and preview query args stay out.
		$path = wp_parse_url( esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ?? '/' ) ), PHP_URL_PATH ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		if ( ! is_string( $path ) || $path === '' ) {
			return;
		}

		$is_404 = is_404();
		$param = $is_404 ? 'from' : 'to';

		$bar->add_node(
			[
				'id' => self::NODE_ID,
				'title' => '<span class="ab-icon dashicons dashicons-randomize" aria-hidden="true"></span>' . esc_html( $is_404 ? __( 'Redirect this 404', 'dsuite-redirects' ) : __( 'Redirect here', 'dsuite-redirects' ) ),
				'href' => admin_url( 'admin.php?page=' . basename( REDIRECTION_FILE ) ) . '#/redirects?new=1&' . $param . '=' . rawurlencode( $path ),
				'meta' => [
					'title' => $is_404 ? __( 'Send this broken address somewhere useful', 'dsuite-redirects' ) : __( 'Create a short link or redirect to this page', 'dsuite-redirects' ),
				],
			]
		);
	}
}
