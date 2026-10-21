<?php

use Redirection\Database\DsrUpgrader;
use Redirection\Redirect\Schedule;

class DsrUpgraderTest extends WP_UnitTestCase {
	private function table() {
		global $wpdb;

		return $wpdb->prefix . 'redirection_items';
	}

	private function columns() {
		global $wpdb;

		return $wpdb->get_col( 'SHOW COLUMNS FROM `' . $this->table() . '`' );
	}

	private function has_schedule_key() {
		global $wpdb;

		return $wpdb->get_var( 'SHOW INDEX FROM `' . $this->table() . "` WHERE Key_name = 'schedule'" ) !== null;
	}

	// Back to upstream's 4.2 schema, as on a site that just switched from Redirection.
	private function remove_schedule_schema() {
		global $wpdb;

		if ( $this->has_schedule_key() ) {
			$wpdb->query( 'ALTER TABLE `' . $this->table() . '` DROP KEY `schedule`' );
		}

		foreach ( [ 'start_at', 'end_at' ] as $column ) {
			if ( in_array( $column, $this->columns(), true ) ) {
				$wpdb->query( 'ALTER TABLE `' . $this->table() . "` DROP COLUMN `$column`" );
			}
		}

		delete_option( Schedule::VERSION_OPTION );
	}

	public function setUp(): void {
		parent::setUp();
		$this->remove_schedule_schema();
	}

	public function tearDown(): void {
		DsrUpgrader::run();
		parent::tearDown();
	}

	public function testAddsScheduleColumnsAndKeyToUpstreamSchema() {
		$this->assertFalse( Schedule::columns_ready() );

		$this->assertTrue( DsrUpgrader::run() );

		$this->assertContains( 'start_at', $this->columns() );
		$this->assertContains( 'end_at', $this->columns() );
		$this->assertTrue( $this->has_schedule_key() );
		$this->assertSame( 1, intval( get_option( Schedule::VERSION_OPTION ) ) );
		$this->assertTrue( Schedule::columns_ready() );
	}

	public function testRunningTwiceIsSafe() {
		$this->assertTrue( DsrUpgrader::run() );
		$this->assertTrue( DsrUpgrader::run() );

		$this->assertSame( 1, count( array_keys( $this->columns(), 'start_at', true ) ) );
	}

	public function testMaybeRunSkipsWhenAlreadyCurrent() {
		update_option( Schedule::VERSION_OPTION, 1 );

		DsrUpgrader::maybe_run();

		$this->assertNotContains( 'start_at', $this->columns() );
	}

	public function testMaybeRunUpgradesWhenBehind() {
		DsrUpgrader::maybe_run();

		$this->assertContains( 'start_at', $this->columns() );
	}

	public function testInstallAlwaysLeavesScheduleColumnsInPlace() {
		// The Fixer and Status recreate missing tables via install() while dsr_db_version may still say 1.
		update_option( Schedule::VERSION_OPTION, 1 );
		$options = get_option( 'redirection_options' );

		( new \Redirection\Database\Schema\Latest() )->install();

		// install() rewrites settings, and the DDL here commits past the test transaction.
		update_option( 'redirection_options', $options );

		$this->assertContains( 'start_at', $this->columns() );
		$this->assertTrue( $this->has_schedule_key() );
	}

	public function testColumnsReadyRepairsAStaleVersionOption() {
		// The option says 1 but the table was recreated without DSuite's columns.
		update_option( Schedule::VERSION_OPTION, 1 );

		$this->assertTrue( Schedule::columns_ready() );
		$this->assertContains( 'start_at', $this->columns() );
	}
}
