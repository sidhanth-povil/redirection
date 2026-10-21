<?php

use Redirection\Plugin\Admin;

require_once ABSPATH . 'wp-admin/includes/plugin.php';

class AdminMenuTest extends WP_UnitTestCase {
	public function tearDown(): void {
		global $menu, $submenu;
		$menu = [];
		$submenu = [];
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function testRegistersTopLevelMenuWithoutSubmenu() {
		global $menu, $submenu;
		$menu = [];
		$submenu = [];
		wp_set_current_user( $this->factory->user->create( [ 'role' => 'administrator' ] ) );

		( new Admin() )->admin_menu();

		$entries = array_values( array_filter( $menu, fn( $item ) => $item[2] === 'dsuite-redirects.php' ) );
		$this->assertCount( 1, $entries, 'top-level menu item missing' );
		$this->assertSame( 'Redirects', $entries[0][0] );
		$this->assertSame( 'dashicons-randomize', $entries[0][6] );
		$this->assertArrayNotHasKey( 'tools.php', $submenu );
		$this->assertArrayNotHasKey( 'dsuite-redirects.php', $submenu );
	}

	public function testLegacyRedirectRunsBeforeUnknownPageCheck() {
		// WordPress rejects an unregistered tools.php page inside wp-admin/menu.php, after admin_menu but before admin_init.
		$admin = new Admin();

		$this->assertNotFalse( has_action( 'admin_menu', [ $admin, 'redirect_legacy_page' ] ) );
	}

	public function testLegacyUrlTarget() {
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php&sub=404s' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php', 'sub' => '404s' ] )
		);
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php' ] )
		);
	}

	public function testLegacyUrlKeepsOtherArgsForSavedRssFeeds() {
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php&sub=rss&module=1&token=abc123' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php', 'sub' => 'rss', 'module' => '1', 'token' => 'abc123' ] )
		);
	}

	public function testLegacyUrlDropsNonStringSub() {
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php', 'sub' => [ 'x' ] ] )
		);
	}

	public function testLegacyUrlIgnoresOtherPages() {
		$this->assertNull( Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'other.php' ] ) );
		$this->assertNull( Admin::get_legacy_redirect( 'admin.php', [ 'page' => 'redirection.php' ] ) );
		$this->assertNull( Admin::get_legacy_redirect( 'tools.php', [] ) );
	}

	public function testLegacyUrlSanitisesSub() {
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php&sub=scriptalert1script' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php', 'sub' => '<script>alert(1)</script>' ] )
		);
	}

	public function testAdminScreenMountsAppInsideWrap() {
		wp_set_current_user( $this->factory->user->create( [ 'role' => 'administrator' ] ) );

		ob_start();
		( new Admin() )->admin_screen();
		$html = (string) ob_get_clean();

		// The header-end marker keeps WP's notice mover from injecting notices into the React tree.
		$this->assertMatchesRegularExpression( '/<div class="wrap">\s*<hr class="wp-header-end">\s*<div id="dsr-app" class="dsr-app notranslate" translate="no">/', $html );
		$this->assertStringNotContainsString( 'id="react-ui"', $html );
	}
}
