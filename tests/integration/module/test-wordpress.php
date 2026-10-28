<?php

class WordPress_Module_Test extends WP_UnitTestCase {
	private function get_404_count() {
		global $wpdb;

		return intval( $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}redirection_404" ), 10 );
	}

	private function get_log_count() {
		global $wpdb;

		return intval( $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}redirection_logs" ), 10 );
	}

	public function testLogBackCompat() {
		$wp = new WordPress_Module();
		$insert = [
			'request_data' => 'data',
			'request_method' => 'method',
			'http_code' => 'code',
			'domain' => 'domain',
			'url' => 'url',
			'redirect_by' => 'redirect_by',
		];

		Red_Options::save( array( 'database' => 4.0 ) );

		$old = $wp->log_back_compat( $insert );

		Red_Options::save( array( 'database' => REDIRECTION_DB_VERSION ) );

		$new = $wp->log_back_compat( $insert );

		$this->assertEquals( $insert, $new );
		$this->assertEquals( [ 'url' => 'url' ], $old );
	}

	public function testCanonicalWP() {
		// Normal canonical redirect
		$wp = new WordPress_Module();
		$this->assertEquals( 'url', $wp->redirect_canonical( 'url', 'target' ) );

		// Canonical redirect when we've already matched this URL
		$wp->reset( new Red_Item() );
		$this->assertFalse( $wp->redirect_canonical( 'url', 'target' ) );
	}

	public function testNo404Log() {
		$wp = new WordPress_Module();
		$start = $this->get_404_count();

		// No log if not a 404 page
		global $wp_query;

		$wp_query->is_404 = false;
		$wp->template_redirect();
		$this->assertEquals( $start, $this->get_404_count() );

		// No log if already matched a URL
		$wp_query->is_404 = true;
		$wp->reset( new Red_Item() );
		$wp->template_redirect();
		$this->assertEquals( $start, $this->get_404_count() );

		// No log if 404 log option is not enabled
		Red_Options::save( array( 'expire_404' => -1 ) );
		$wp->reset();
		$wp->template_redirect();
		$this->assertEquals( $start, $this->get_404_count() );

		$wp_query->is_404 = false;
	}

	public function test404Log() {
		global $wp_query;

		$wp_query->is_404 = true;
		Red_Options::save( array( 'expire_404' => 7 ) );

		// Log if it is a 404 page and not matched and option is enabled
		$wp = new WordPress_Module();
		$start = $this->get_404_count();
		$wp->template_redirect();
		$this->assertEquals( $start + 1, $this->get_404_count() );

		$wp_query->is_404 = false;
	}

	public function testDoNothing() {
		$wp = new WordPress_Module();
		$this->assertTrue( $wp->can_log() );

		$wp->redirection_do_nothing();
		$this->assertFalse( $wp->can_log() );
	}

	public function testNoExternalIfRedirection() {
		$_SERVER['REQUEST_URI'] = '/test';
		Red_Options::save( array( 'log_external' => true ) );
		$start = $this->get_log_count();

		$wp = new WordPress_Module();
		$wp->record_redirect_by( 'dsuite-redirects' );

		$this->assertEquals( $start, $this->get_log_count() );
	}

	public function testNoExternalIfNotEnabled() {
		$_SERVER['REQUEST_URI'] = '/test';
		Red_Options::save( array( 'log_external' => false ) );
		$start = $this->get_log_count();

		$wp = new WordPress_Module();
		$wp->record_redirect_by( 'wordpress' );

		$this->assertEquals( $start, $this->get_log_count() );
	}

	public function testExternal() {
		$_SERVER['REQUEST_URI'] = '/test';
		Red_Options::save( array( 'log_external' => true ) );
		$start = $this->get_log_count();

		$wp = new WordPress_Module();
		$wp->record_redirect_by( 'wordpress' );

		$this->assertEquals( $start + 1, $this->get_log_count() );
	}

	private function get_matched( $match_type ) {
		return new Red_Item( (object) [ 'id' => 1, 'match_type' => $match_type, 'action_type' => 'url', 'url' => '/a', 'action_data' => '/b', 'action_code' => 301, 'status' => 'enabled' ] );
	}

	public function testPlainRedirectIsCached() {
		Red_Options::save( [ 'redirect_cache' => 1 ] );
		$wp = new WordPress_Module();
		$wp->reset( $this->get_matched( 'url' ) );

		$this->assertSame( 'max-age=3600', $wp->get_cache_headers( 301, [] )['Cache-Control'] );
	}

	public function testVisitorDependentRedirectIsNotShared() {
		Red_Options::save( [ 'redirect_cache' => 1 ] );
		$wp = new WordPress_Module();
		$wp->reset( $this->get_matched( 'agent' ) );

		// A shared cache keyed on the URL would give one visitor's redirect to everyone
		$this->assertStringContainsString( 'private', $wp->get_cache_headers( 301, [] )['Cache-Control'] );
		$this->assertStringContainsString( 'private', $wp->get_cache_headers( 308, [] )['Cache-Control'] );
	}

	public function testOperatorCacheControlIsKept() {
		Red_Options::save( [ 'redirect_cache' => 1 ] );
		$wp = new WordPress_Module();
		$wp->reset( $this->get_matched( 'url' ) );

		$this->assertSame( [], $wp->get_cache_headers( 301, [ [ 'headerName' => 'Cache-Control', 'headerValue' => 'no-store' ] ] ) );
	}
}
