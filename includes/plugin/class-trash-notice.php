<?php

namespace Redirection\Plugin;

use Redirection\Core\Capabilities;
use Redirection\Redirect\Redirect;

/**
 * After published posts go to the trash, offers to redirect their old addresses, which now show a 404.
 * Both the post list and the block editor land on edit.php?trashed=N&ids=… afterwards.
 */
class TrashNotice {
	const MAX_POSTS = 5;

	/**
	 * @return void
	 */
	public static function show() {
		$screen = get_current_screen();
		if ( $screen === null || $screen->base !== 'edit' || ! Capabilities::has_access( Capabilities::CAP_REDIRECT_ADD ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only; core's own "moved to the trash" parameters.
		$ids = isset( $_GET['trashed'], $_GET['ids'] ) ? wp_parse_id_list( wp_unslash( (string) $_GET['ids'] ) ) : [];
		$paths = self::unhandled_paths( array_slice( $ids, 0, self::MAX_POSTS ) );
		if ( count( $paths ) === 0 ) {
			return;
		}

		$page = admin_url( 'admin.php?page=' . basename( REDIRECTION_FILE ) );
		$items = '';

		foreach ( $paths as $path ) {
			$items .= sprintf(
				'<li><code>%1$s</code> <a href="%2$s">%3$s</a></li>',
				esc_html( $path ),
				esc_url( $page . '#/redirects?new=1&from=' . rawurlencode( $path ) ),
				esc_html__( 'Add a redirect', 'dsuite-redirects' )
			);
		}

		printf(
			'<div class="notice notice-warning is-dismissible"><p>%1$s</p><ul>%2$s</ul></div>',
			esc_html( _n( 'This address now shows a 404 page. Send its visitors somewhere useful:', 'These addresses now show a 404 page. Send their visitors somewhere useful:', count( $paths ), 'dsuite-redirects' ) ),
			$items // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		);
	}

	/**
	 * Old addresses of trashed posts that were live and that no redirect handles yet.
	 *
	 * @param array<int> $ids Trashed post IDs.
	 * @return list<string>
	 */
	public static function unhandled_paths( array $ids ) {
		$paths = [];

		foreach ( $ids as $id ) {
			$path = self::old_path( $id );

			if ( $path !== '' && ! Redirect::matches_any( $path ) ) {
				$paths[] = $path;
			}
		}

		return $paths;
	}

	/**
	 * The address a trashed post had while published. Core renames it to slug__trashed and keeps the old slug in meta.
	 *
	 * @param int $id Post ID.
	 * @return string Path, or '' when it was never live.
	 */
	private static function old_path( $id ) {
		$post = get_post( $id );
		if ( $post === null || $post->post_status !== 'trash' || get_post_meta( $id, '_wp_trash_meta_status', true ) !== 'publish' ) {
			return '';
		}

		$live = clone $post;
		$live->post_status = 'publish';
		$slug = (string) get_post_meta( $id, '_wp_desired_post_slug', true );
		if ( $slug !== '' ) {
			$live->post_name = $slug;
		}

		$permalink = get_permalink( $live );
		if ( $permalink === false ) {
			return '';
		}

		$path = wp_make_link_relative( $permalink );

		return $path === '/' ? '' : $path;
	}
}
