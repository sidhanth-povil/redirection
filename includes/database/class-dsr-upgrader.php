<?php

namespace Redirection\Database;

use Redirection\Redirect\Schedule;
use Redirection\Settings\Settings;
use Redirection\Url\SourceFlags;

/**
 * DSuite's own schema changes, tracked in `dsr_db_version` so upstream's REDIRECTION_DB_VERSION never moves.
 *
 * Version 1: start_at / end_at schedule columns on redirection_items.
 * Version 2: new redirects keep query strings (UTM, fbclid) by default.
 * Version 3: purpose groups, so each redirect says why it exists (Print QR, Meta Ad…).
 */
class DsrUpgrader {
	const VERSION = 3;
	const PURPOSE_GROUPS = [ 'Print QR', 'Meta Ad', 'SEO Migration', 'Bio Link' ];

	/**
	 * Cheap check for admin_init: one autoloaded option read when nothing is pending.
	 *
	 * @return void
	 */
	public static function maybe_run() {
		// admin_init also fires for anonymous admin-ajax.php and admin-post.php requests; schema changes wait for
		// someone who manages the plugin
		if ( ! \Redirection_Capabilities::has_access( \Redirection_Capabilities::CAP_OPTION_MANAGE ) ) {
			return;
		}

		if ( intval( get_option( Schedule::VERSION_OPTION, 0 ), 10 ) < self::VERSION ) {
			self::run();
		}
	}

	/**
	 * Add any missing schedule columns and key. Safe to run repeatedly.
	 * On failure the version is left alone so the next admin page load retries.
	 *
	 * @return bool
	 */
	public static function run() {
		global $wpdb;

		if ( ! self::add_schedule_columns() ) {
			return false;
		}

		$before = intval( get_option( Schedule::VERSION_OPTION, 0 ), 10 );

		if ( $before < 2 && ! self::default_query_to_pass() ) {
			// @phpstan-ignore disallowed.function
			error_log( 'DSuite Redirects: unable to keep existing redirects on exact query matching: ' . $wpdb->last_error ); // phpcs:ignore
			return false;
		}

		// Only once: a group someone deletes later stays deleted.
		if ( $before < 3 && ! self::add_purpose_groups() ) {
			// @phpstan-ignore disallowed.function
			error_log( 'DSuite Redirects: unable to add purpose groups: ' . $wpdb->last_error ); // phpcs:ignore
			return false;
		}

		update_option( Schedule::VERSION_OPTION, self::VERSION );

		return true;
	}

	/**
	 * Groups double as campaign tags. Added beside the existing ones, in the WordPress module, skipping any name a
	 * site already has (in any letter case).
	 *
	 * @return bool False if the groups table is missing or a group could not be added; the next load retries.
	 */
	private static function add_purpose_groups() {
		global $wpdb;

		$table = $wpdb->prefix . 'redirection_groups';
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return false;
		}

		$existing = array_map( 'strtolower', $wpdb->get_col( "SELECT name FROM {$wpdb->prefix}redirection_groups" ) );

		foreach ( self::PURPOSE_GROUPS as $name ) {
			if ( ! in_array( strtolower( $name ), $existing, true ) && \Red_Group::create( $name, \Redirection\Module\Plugin::MODULE_ID ) === false ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Schema v1 only: the schedule columns and key. Schedule::columns_ready() repairs a recreated table with this,
	 * and runs for anyone who manages redirects, so it must not touch settings, rows or groups.
	 *
	 * @return bool
	 */
	public static function add_schedule_columns() {
		global $wpdb;

		$table = $wpdb->prefix . 'redirection_items';

		// Not installed yet (welcome wizard pending): try again on a later load.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return false;
		}

		$columns = $wpdb->get_col( "SHOW COLUMNS FROM `{$wpdb->prefix}redirection_items`" );
		$changes = [];

		if ( ! in_array( 'start_at', $columns, true ) ) {
			$changes[] = 'ADD COLUMN `start_at` DATETIME NULL DEFAULT NULL';
		}

		if ( ! in_array( 'end_at', $columns, true ) ) {
			$changes[] = 'ADD COLUMN `end_at` DATETIME NULL DEFAULT NULL';
		}

		if ( $wpdb->get_var( "SHOW INDEX FROM `{$wpdb->prefix}redirection_items` WHERE Key_name = 'schedule'" ) === null ) {
			$changes[] = 'ADD KEY `schedule` (`start_at`,`end_at`)';
		}

		// $changes holds only the fixed clauses above.
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		if ( count( $changes ) > 0 && $wpdb->query( "ALTER TABLE `{$wpdb->prefix}redirection_items` " . implode( ', ', $changes ) ) === false ) {
			// @phpstan-ignore disallowed.function
			error_log( 'DSuite Redirects: unable to add schedule columns: ' . $wpdb->last_error ); // phpcs:ignore
			return false;
		}

		return true;
	}

	/**
	 * An exact query default never matches ad traffic (/sale?utm_source=ig), so new redirects pass the query on.
	 * A site that chose ignore or exact-order keeps that.
	 *
	 * @return bool False if existing redirects could not be pinned; the default is then left alone.
	 */
	private static function default_query_to_pass() {
		$options = Settings::get();

		if ( $options['flag_query'] !== SourceFlags::QUERY_EXACT ) {
			return true;
		}

		if ( ! self::pin_exact_query() ) {
			return false;
		}

		// Saving one flag resets the others to their defaults, so send them all.
		$settings = [
			'flag_query' => SourceFlags::QUERY_PASS,
			'flag_case' => $options['flag_case'],
			'flag_trailing' => $options['flag_trailing'],
			'flag_regex' => $options['flag_regex'],
		];

		// Cached lookups hold rows from before the pin; a new key retires them, as Admin::clear_cache does.
		if ( $options['cache_key'] > 0 ) {
			$settings['cache_key'] = time();
		}

		Settings::save( $settings );

		return true;
	}

	/**
	 * Saves drop flags that equal the site default, so redirects saved under exact store no query flag and would
	 * follow the new default. Store exact on them so they keep matching as they do today.
	 *
	 * @return bool
	 */
	private static function pin_exact_query() {
		global $wpdb;

		// ponytail: one UPDATE per row, run once per site; batch it if an upgrade on a huge table ever times out
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, match_data FROM {$wpdb->prefix}redirection_items WHERE match_data IS NULL OR match_data NOT LIKE %s",
				'%' . $wpdb->esc_like( '"flag_query"' ) . '%'
			)
		);

		foreach ( $rows as $row ) {
			$data = json_decode( (string) $row->match_data, true );
			$data = is_array( $data ) ? $data : [];
			$source = isset( $data['source'] ) && is_array( $data['source'] ) ? $data['source'] : [];
			$data['source'] = array_merge( $source, [ 'flag_query' => SourceFlags::QUERY_EXACT ] );

			if ( $wpdb->update( $wpdb->prefix . 'redirection_items', [ 'match_data' => wp_json_encode( $data ) ], [ 'id' => $row->id ] ) === false ) {
				return false;
			}
		}

		return true;
	}
}
