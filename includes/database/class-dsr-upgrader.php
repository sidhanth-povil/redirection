<?php

namespace Redirection\Database;

use Redirection\Redirect\Schedule;

/**
 * DSuite's own schema changes, tracked in `dsr_db_version` so upstream's REDIRECTION_DB_VERSION never moves.
 *
 * Version 1: start_at / end_at schedule columns on redirection_items.
 */
class DsrUpgrader {
	const VERSION = 1;

	/**
	 * Cheap check for admin_init: one autoloaded option read when nothing is pending.
	 *
	 * @return void
	 */
	public static function maybe_run() {
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

		$table = $wpdb->prefix . 'redirection_items';

		// Not installed yet (welcome wizard pending): try again on a later load.
		if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) !== $table ) {
			return false;
		}

		$columns = $wpdb->get_col( "SHOW COLUMNS FROM `$table`" );
		$changes = [];

		if ( ! in_array( 'start_at', $columns, true ) ) {
			$changes[] = 'ADD COLUMN `start_at` DATETIME NULL DEFAULT NULL';
		}

		if ( ! in_array( 'end_at', $columns, true ) ) {
			$changes[] = 'ADD COLUMN `end_at` DATETIME NULL DEFAULT NULL';
		}

		if ( $wpdb->get_var( "SHOW INDEX FROM `$table` WHERE Key_name = 'schedule'" ) === null ) {
			$changes[] = 'ADD KEY `schedule` (`start_at`,`end_at`)';
		}

		if ( count( $changes ) > 0 && $wpdb->query( "ALTER TABLE `$table` " . implode( ', ', $changes ) ) === false ) {
			// @phpstan-ignore disallowed.function
			error_log( 'DSuite Redirects: unable to add schedule columns: ' . $wpdb->last_error ); // phpcs:ignore
			return false;
		}

		update_option( Schedule::VERSION_OPTION, self::VERSION );

		return true;
	}
}
