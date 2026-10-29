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
		$this->assertSame( DsrUpgrader::VERSION, intval( get_option( Schedule::VERSION_OPTION ) ) );
		$this->assertTrue( Schedule::columns_ready() );
	}

	public function testRunningTwiceIsSafe() {
		$this->assertTrue( DsrUpgrader::run() );
		$this->assertTrue( DsrUpgrader::run() );

		$this->assertSame( 1, count( array_keys( $this->columns(), 'start_at', true ) ) );
	}

	public function testMaybeRunSkipsWhenAlreadyCurrent() {
		update_option( Schedule::VERSION_OPTION, DsrUpgrader::VERSION );

		DsrUpgrader::maybe_run();

		$this->assertNotContains( 'start_at', $this->columns() );
	}

	public function testMaybeRunUpgradesWhenBehind() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		DsrUpgrader::maybe_run();
		wp_set_current_user( 0 );

		$this->assertContains( 'start_at', $this->columns() );
	}

	public function testMaybeRunWaitsForAnAdministrator() {
		// admin_init also runs for anonymous admin-ajax.php and admin-post.php requests
		DsrUpgrader::maybe_run();

		$this->assertNotContains( 'start_at', $this->columns() );
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

	private function set_query_default( $flag_query ) {
		\Redirection\Settings\Settings::save( [ 'flag_query' => $flag_query, 'flag_case' => true, 'flag_trailing' => true, 'flag_regex' => false ] );
	}

	public function testUpgradeKeepsQueryStringsByDefault() {
		// Ad traffic arrives as /sale?utm_source=ig; an exact default never matched it.
		$this->set_query_default( 'exact' );
		update_option( Schedule::VERSION_OPTION, 1 );

		DsrUpgrader::run();

		$options = \Redirection\Settings\Settings::get();
		$this->assertSame( 'pass', $options['flag_query'] );
		$this->assertTrue( $options['flag_case'] );
		$this->assertTrue( $options['flag_trailing'] );
	}

	public function testUpgradeLeavesAChosenQueryDefaultAlone() {
		$this->set_query_default( 'ignore' );
		update_option( Schedule::VERSION_OPTION, 1 );

		DsrUpgrader::run();

		$this->assertSame( 'ignore', \Redirection\Settings\Settings::get()['flag_query'] );
	}

	private function query_flag( $id ) {
		return Red_Item::get_by_id( $id )->get_match_data()['source']['flag_query'];
	}

	public function testUpgradeLeavesExistingRedirectsMatchingExactly() {
		// Saved under the exact default, so the row stores no query flag of its own and would inherit pass.
		$this->set_query_default( 'exact' );
		$group = Red_Group::create( 'group', 1 );
		$plain = Red_Item::create( [ 'url' => '/sale', 'action_data' => [ 'url' => '/shop' ], 'group_id' => $group->get_id(), 'action_type' => 'url', 'match_type' => 'url' ] );
		$chosen = Red_Item::create( [ 'url' => '/promo', 'action_data' => [ 'url' => '/shop' ], 'group_id' => $group->get_id(), 'action_type' => 'url', 'match_type' => 'url', 'match_data' => [ 'source' => [ 'flag_query' => 'ignore' ] ] ] );
		update_option( Schedule::VERSION_OPTION, 1 );

		DsrUpgrader::run();

		$this->assertSame( 'exact', $this->query_flag( $plain->get_id() ) );
		$this->assertSame( 'ignore', $this->query_flag( $chosen->get_id() ) );
	}

	public function testQueryDefaultFlipsOnlyOnce() {
		// Someone who sets exact again after the upgrade keeps it.
		DsrUpgrader::run();
		$this->set_query_default( 'exact' );

		DsrUpgrader::run();

		$this->assertSame( 'exact', \Redirection\Settings\Settings::get()['flag_query'] );
	}

	private function group_names() {
		global $wpdb;

		return $wpdb->get_col( "SELECT name FROM {$wpdb->prefix}redirection_groups ORDER BY id" );
	}

	public function testAddsPurposeGroupsOnce() {
		update_option( Schedule::VERSION_OPTION, 2 );

		DsrUpgrader::run();
		DsrUpgrader::run();

		foreach ( DsrUpgrader::PURPOSE_GROUPS as $name ) {
			$this->assertSame( 1, count( array_keys( $this->group_names(), $name, true ) ), $name );
		}
	}

	public function testADeletedPurposeGroupStaysDeleted() {
		global $wpdb;

		update_option( Schedule::VERSION_OPTION, 2 );
		DsrUpgrader::run();
		$wpdb->delete( $wpdb->prefix . 'redirection_groups', [ 'name' => 'Bio Link' ] );

		DsrUpgrader::run();

		$this->assertNotContains( 'Bio Link', $this->group_names() );
	}

	public function testKeepsAPurposeGroupTheSiteAlreadyHasInAnyCase() {
		update_option( Schedule::VERSION_OPTION, 2 );
		Red_Group::create( 'print qr', 1 );

		DsrUpgrader::run();

		$this->assertNotContains( 'Print QR', $this->group_names() );
		$this->assertContains( 'print qr', $this->group_names() );
	}

	public function testColumnRepairDoesNotRunTheOtherUpgrades() {
		// Schedule::columns_ready() runs for redirect managers, not just admins: it may only add columns back.
		global $wpdb;

		update_option( Schedule::VERSION_OPTION, 1 );
		$groups = count( $this->group_names() );

		$this->assertTrue( Schedule::columns_ready() );

		$this->assertSame( $groups, count( $this->group_names() ) );
		$this->assertSame( 1, intval( get_option( Schedule::VERSION_OPTION ) ) );
	}
}
