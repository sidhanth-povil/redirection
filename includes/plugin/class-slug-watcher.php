<?php

namespace Redirection\Plugin;

use Redirection\Redirect\Redirect;
use WP_Post;

/**
 * When a published page's address changes, redirects pointing at the old address follow it. Without this they would
 * reach the page through the monitor's old → new redirect: a chain. Always on, separate from the monitor settings.
 */
class SlugWatcher {
	/**
	 * Permalinks before the update in progress, by post ID.
	 *
	 * @var array<int, string>
	 */
	private static $before = [];

	/**
	 * @param int                  $post_id Post ID.
	 * @param array<string, mixed> $data Post data about to be saved.
	 * @return void
	 */
	public static function remember( $post_id, $data = [] ) {
		$permalink = get_post_status( $post_id ) === 'publish' ? get_permalink( $post_id ) : false;

		if ( is_string( $permalink ) ) {
			self::$before[ $post_id ] = $permalink;
		}
	}

	/**
	 * @param int          $post_id Post ID.
	 * @param WP_Post|null $post Post after the update.
	 * @param WP_Post|null $post_before Post before the update.
	 * @return void
	 */
	public static function follow( $post_id, $post, $post_before ) {
		$before = self::$before[ $post_id ] ?? '';
		unset( self::$before[ $post_id ] );

		if ( $before === '' || ! $post instanceof WP_Post || $post->post_status !== 'publish' ) {
			return;
		}

		$after = get_permalink( $post_id );
		if ( ! is_string( $after ) || $after === $before ) {
			return;
		}

		self::retarget( self::variants( $before, $after ), (string) wp_parse_url( $after, PHP_URL_PATH ) );
	}

	/**
	 * Each way a target may name the old address, mapped to the new one in the same form.
	 *
	 * @param string $before Old permalink.
	 * @param string $after New permalink.
	 * @return array<string, string>
	 */
	private static function variants( $before, $after ) {
		$old_path = (string) wp_parse_url( $before, PHP_URL_PATH );
		$new_path = (string) wp_parse_url( $after, PHP_URL_PATH );

		return [
			$before => $after,
			untrailingslashit( $before ) => untrailingslashit( $after ),
			$old_path => $new_path,
			untrailingslashit( $old_path ) => untrailingslashit( $new_path ),
		];
	}

	/**
	 * @param array<string, string> $map Old target to new target.
	 * @param string                $new_path The page's new path.
	 * @return void
	 */
	private static function retarget( array $map, $new_path ) {
		global $wpdb;

		// The site root is a variant only for a page at /; never rewrite every redirect to the home page.
		unset( $map[''], $map['/'] );
		if ( count( $map ) === 0 ) {
			return;
		}

		$targets = array_keys( $map );
		$placeholders = implode( ', ', array_fill( 0, count( $targets ), '%s' ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders are generated above
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, url, action_data FROM {$wpdb->prefix}redirection_items WHERE action_type='url' AND action_data IN ($placeholders)", $targets ) );

		foreach ( $rows as $row ) {
			// MySQL's IN ignores case, so /About matched /about; only an exact match is the page's address.
			if ( ! isset( $map[ $row->action_data ] ) ) {
				continue;
			}

			// The page moved onto this redirect's own source; pointing it there would make it redirect to itself.
			if ( untrailingslashit( strtolower( $row->url ) ) === untrailingslashit( strtolower( $new_path ) ) ) {
				continue;
			}

			$wpdb->update( $wpdb->prefix . 'redirection_items', [ 'action_data' => $map[ $row->action_data ] ], [ 'id' => $row->id ] );
			// Clears the redirect cache, as any other edit does.
			do_action( 'redirection_redirect_updated', (int) $row->id, Redirect::get_by_id( (int) $row->id ) );
		}
	}
}
