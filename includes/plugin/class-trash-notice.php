<?php

namespace Redirection\Plugin;

use Redirection\Core\Capabilities;
use Redirection\Redirect\Redirect;

/**
 * When a published post of any public type is trashed or deleted, its address starts showing a 404. The address is
 * remembered at that moment, while the post can still say what it was, and the next admin page shows a card in the
 * bottom right offering to redirect it. Recording it then, rather than reading edit.php?trashed=… afterwards, covers
 * the block editor, custom admin screens, post types without a trash, and bulk actions alike.
 */
class TrashNotice {
	const MAX_PATHS = 5;
	const CACHE_PREFIX = 'dsr_removed_';
	const CACHE_SECONDS = HOUR_IN_SECONDS;

	// Inline because the card shows on any admin screen, where the plugin's own stylesheet isn't loaded.
	// z-index sits below the admin bar (99999) and above the admin menu (9990), like the plugin's drawer.
	const CSS = '
		.dsr-toast { position: fixed; right: 24px; bottom: 24px; z-index: 99990; box-sizing: border-box; width: min(380px, calc(100vw - 32px)); padding: 20px 22px 16px; background: #fff; border: 1px solid #eef0f3; border-radius: 16px; box-shadow: 0 18px 48px rgba(17, 24, 39, 0.14), 0 2px 6px rgba(17, 24, 39, 0.06); font-size: 14px; animation: dsr-toast-in 220ms ease-out; }
		.dsr-toast * { box-sizing: border-box; }
		.dsr-toast__close { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: #f3f4f6; color: #6b7280; font-size: 18px; line-height: 28px; cursor: pointer; }
		.dsr-toast__close:hover { background: #e5e7eb; color: #111827; }
		.dsr-toast__label { display: flex; align-items: center; gap: 8px; margin: 0 36px 8px 0; color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
		.dsr-toast__label .dashicons { color: #4f46e5; font-size: 18px; width: 18px; height: 18px; }
		.dsr-toast__message { margin: 0 0 12px; color: #4b5563; font-size: 15px; line-height: 1.45; }
		.dsr-toast__list { margin: 0 0 8px; padding: 0; list-style: none; }
		.dsr-toast__list li { display: flex; align-items: center; gap: 10px; margin: 0 0 8px; }
		.dsr-toast__list code { flex: 1; min-width: 0; overflow: hidden; padding: 6px 8px; border-radius: 8px; background: #f5f6f8; color: #111827; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
		.dsr-toast__primary { flex-shrink: 0; padding: 7px 14px; border-radius: 8px; background: #4f46e5; color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
		.dsr-toast__primary:hover, .dsr-toast__primary:focus { background: #4338ca; color: #fff; }
		.dsr-toast__secondary { padding: 6px 0; border: 0; background: none; color: #6b7280; font-size: 13px; cursor: pointer; }
		.dsr-toast__secondary:hover { color: #111827; text-decoration: underline; }
		.dsr-toast a:focus-visible, .dsr-toast button:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; box-shadow: none; }
		@keyframes dsr-toast-in { from { opacity: 0; transform: translateY(12px); } }
		@media (prefers-reduced-motion: reduce) { .dsr-toast { animation: none; } }
		@media (max-width: 600px) { .dsr-toast { right: 16px; bottom: 16px; } }
	';

	// Esc only closes the card while focus is on it or on nothing, so it never steals Esc from the editor.
	const SCRIPT = '
		( function () {
			var card = document.querySelector( ".dsr-toast" );
			if ( ! card ) { return; }
			function close() { card.remove(); document.removeEventListener( "keydown", onKey ); }
			function onKey( event ) {
				if ( event.key === "Escape" && ( card.contains( document.activeElement ) || document.activeElement === document.body ) ) { close(); }
			}
			card.querySelectorAll( "[data-dsr-toast-close]" ).forEach( function ( button ) { button.addEventListener( "click", close ); } );
			document.addEventListener( "keydown", onKey );
		} )();
	';

	/**
	 * @param int $post_id Post about to be trashed or deleted.
	 * @return void
	 */
	public static function remember( $post_id ) {
		$user_id = get_current_user_id();
		$post = get_post( $post_id );
		if ( $user_id === 0 || $post === null || $post->post_status !== 'publish' || ! is_post_type_viewable( $post->post_type ) ) {
			return;
		}

		$permalink = get_permalink( $post );
		$path = $permalink === false ? '/' : wp_make_link_relative( $permalink );
		if ( $path === '/' ) {
			return;
		}

		$removed = array_filter( self::get_removed( $user_id ), fn( $item ) => $item['post_id'] !== $post->ID );
		$removed[] = [
			'post_id' => $post->ID,
			'path' => $path,
		];

		set_transient( self::CACHE_PREFIX . $user_id, array_slice( array_values( $removed ), -self::MAX_PATHS ), self::CACHE_SECONDS );
	}

	/**
	 * Undo puts the post back at its address, so there is nothing to redirect.
	 *
	 * @param int $post_id Restored post.
	 * @return void
	 */
	public static function forget( $post_id ) {
		$user_id = get_current_user_id();
		$removed = array_filter( self::get_removed( $user_id ), fn( $item ) => $item['post_id'] !== (int) $post_id );

		set_transient( self::CACHE_PREFIX . $user_id, array_values( $removed ), self::CACHE_SECONDS );
	}

	/**
	 * Shows the card once, then forgets the addresses.
	 *
	 * @return void
	 */
	public static function show() {
		$user_id = get_current_user_id();
		$paths = self::take_paths( $user_id );
		if ( count( $paths ) === 0 || ! Capabilities::has_access( Capabilities::CAP_REDIRECT_ADD ) ) {
			return;
		}

		$page = admin_url( 'admin.php?page=' . basename( REDIRECTION_FILE ) );
		$rows = '';

		foreach ( $paths as $path ) {
			$rows .= sprintf(
				'<li><code title="%1$s">%2$s</code><a class="dsr-toast__primary" href="%3$s" data-dsr-toast-close>%4$s</a></li>',
				esc_attr( $path ),
				esc_html( $path ),
				esc_url( $page . '#/redirects?new=1&from=' . rawurlencode( $path ) ),
				esc_html__( 'Add redirect', 'dsuite-redirects' )
			);
		}

		$message = _n(
			'This address now shows a 404 page. Send its visitors somewhere useful?',
			'These addresses now show a 404 page. Send their visitors somewhere useful?',
			count( $paths ),
			'dsuite-redirects'
		);

		// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped -- $rows and the static CSS/JS are built above.
		printf(
			'<style>%1$s</style>
			<div class="dsr-toast" role="dialog" aria-modal="false" aria-labelledby="dsr-toast-title">
				<button type="button" class="dsr-toast__close" data-dsr-toast-close aria-label="%2$s">&times;</button>
				<p class="dsr-toast__label" id="dsr-toast-title"><span class="dashicons dashicons-randomize" aria-hidden="true"></span>%3$s</p>
				<p class="dsr-toast__message">%4$s</p>
				<ul class="dsr-toast__list">%5$s</ul>
				<button type="button" class="dsr-toast__secondary" data-dsr-toast-close>%6$s</button>
			</div>
			<script>%7$s</script>',
			self::CSS,
			esc_attr__( 'Close', 'dsuite-redirects' ),
			esc_html__( 'Page removed', 'dsuite-redirects' ),
			esc_html( $message ),
			$rows,
			esc_html__( 'Not now', 'dsuite-redirects' ),
			self::SCRIPT
		);
		// phpcs:enable
	}

	/**
	 * Addresses still worth redirecting: not restored, not already handled by a redirect. Clears the list.
	 *
	 * @param int $user_id User who removed the posts.
	 * @return list<string>
	 */
	public static function take_paths( $user_id ) {
		$removed = self::get_removed( $user_id );
		if ( count( $removed ) === 0 ) {
			return [];
		}

		delete_transient( self::CACHE_PREFIX . $user_id );

		$paths = [];
		foreach ( $removed as $item ) {
			if ( get_post_status( $item['post_id'] ) !== 'publish' && ! Redirect::matches_any( $item['path'] ) ) {
				$paths[] = $item['path'];
			}
		}

		return array_values( array_unique( $paths ) );
	}

	/**
	 * @param int $user_id User ID.
	 * @return list<array{post_id: int, path: string}>
	 */
	private static function get_removed( $user_id ) {
		if ( $user_id === 0 ) {
			return [];
		}

		$removed = get_transient( self::CACHE_PREFIX . $user_id );

		/** @var list<array{post_id: int, path: string}> */
		return is_array( $removed ) ? $removed : [];
	}
}
