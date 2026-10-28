<?php

use Brain\Monkey\Functions;

require_once PLUGIN_PATH . '/models/canonical.php';

class Canonical_Test extends WP_UnitTestCase {
	public function testNoCanonical() {
		$canonical = new Redirection_Canonical( false, '', [], 'http://example.org' );
		$this->assertFalse( $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
	}

	public function testWwwIsRemovedAsAPrefixOnly() {
		// ltrim( 'www.web.com', 'www.' ) removes a set of characters and gives 'eb.com'
		$add = new \Redirection\Plugin\Canonical( false, 'www', [], 'http://www.web.com' );
		$remove = new \Redirection\Plugin\Canonical( false, 'nowww', [], 'http://web.com' );

		$home = 'http://web.com';
		$filter = function () use ( &$home ) {
			return $home;
		};
		add_filter( 'home_url', $filter );

		$added = $add->get_redirect( 'web.com', '/a' );
		$home = 'http://www.web.com';
		$removed = $remove->get_redirect( 'www.web.com', '/a' );
		remove_filter( 'home_url', $filter );

		$this->assertEquals( 'http://www.web.com/a', $added );
		$this->assertEquals( 'http://web.com/a', $removed );
	}

	public function testRelocateProtectsAdminWhateverTheSpelling() {
		$canonical = new \Redirection\Plugin\Canonical( true, '', [], 'http://example.org' );

		$this->assertFalse( $canonical->relocate_request( 'https://relocate.org', 'example.org', '//wp-admin/index.php' ) );
		$this->assertFalse( $canonical->relocate_request( 'https://relocate.org', 'example.org', '/WP-LOGIN.php' ) );
		$this->assertFalse( $canonical->relocate_request( 'https://relocate.org', 'example.org', '/?rest_route=/redirection/v1/setting' ) );
		$this->assertEquals( 'https://relocate.org/page', $canonical->relocate_request( 'https://relocate.org', 'example.org', '/page' ) );
	}

/*
	public function testHttps() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, '', [], 'https://example.org' );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'https://example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1&arg2[]=2', $canonical->get_redirect( 'http://example.org', '/request?arg=1&arg2[]=2' ) );
		$this->assertEquals( 'https://example.org/request?arg=1&arg2[]=中国', $canonical->get_redirect( 'http://example.org', '/request?arg=1&arg2[]=中国' ) );
	}

	public function testPreferredWWW() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://www.example.org' );

		$canonical = new Redirection_Canonical( true, 'www', [], 'https://www.example.org' );
		$this->assertEquals( 'https://www.example.org/request?arg=1', $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://www.example.org/request?arg=1', $canonical->get_redirect( 'http://www.example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://www.example.org/request?arg=1', $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://www.example.org/request?arg=1&arg2[]=2', $canonical->get_redirect( 'http://example.org', '/request?arg=1&arg2[]=2' ) );
		$this->assertEquals( 'https://www.example.org/request?arg=1&arg2[]=中国', $canonical->get_redirect( 'http://example.org', '/request?arg=1&arg2[]=中国' ) );
	}

	public function testPreferredRemoveWWW() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, 'nowww', [], 'https://example.org' );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://www.example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://www.example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1&arg2[]=2', $canonical->get_redirect( 'http://www.example.org', '/request?arg=1&arg2[]=2' ) );
		$this->assertEquals( 'https://example.org/request?arg=1&arg2[]=中国', $canonical->get_redirect( 'http://www.example.org', '/request?arg=1&arg2[]=中国' ) );
	}

	public function testAlias() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, '', [ 'cat.com', 'dog.com' ], 'https://example.org' );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://cat.com', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://dog.com', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1', $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://example.org/request?arg=1&arg2[]=2', $canonical->get_redirect( 'http://example.org', '/request?arg=1&arg2[]=2' ) );
		$this->assertEquals( 'https://example.org/request?arg=1&arg2[]=中国', $canonical->get_redirect( 'http://example.org', '/request?arg=1&arg2[]=中国' ) );
	}

	public function testRelocate() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, '', [], 'https://relocate.org' );
		$this->assertEquals( 'https://relocate.org/request?arg=1', $canonical->relocate_request( 'https://relocate.org', 'example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://relocate.org/request?arg=1', $canonical->relocate_request( 'https://relocate.org/', 'example.org', '/request?arg=1' ) );
		$this->assertEquals( 'https://relocate.org/request?arg[]=1', $canonical->relocate_request( 'https://relocate.org/', 'example.org', '/request?arg[]=1' ) );
		$this->assertEquals( 'https://relocate.org/request?arg[]=中国', $canonical->relocate_request( 'https://relocate.org/', 'example.org', '/request?arg[]=中国' ) );
	}

	public function testRelocateIgnore() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, '', [], 'http://example.org' );
		$this->assertFalse( $canonical->relocate_request( 'https://relocate.org', 'example.org', '/wp-json/redirection' ) );
		$this->assertFalse( $canonical->relocate_request( 'https://relocate.org', 'example.org', '/wp-admin/index.php' ) );
		$this->assertFalse( $canonical->relocate_request( 'https://relocate.org', 'example.org', '/wp-login.php' ) );
	}

	public function testPreferredInvalidSite() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, 'www', [], 'https://example.org' );
		$this->assertFalse( $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );

		$canonical = new Redirection_Canonical( true, 'nowww', [], 'https://www.example.org' );
		$this->assertFalse( $canonical->get_redirect( 'http://www.example.org', '/request?arg=1' ) );
	}

	public function testHttpsInvalidSite() {
		Functions\expect( 'get_bloginfo' )->with( 'url' )->andReturn( 'https://example.org' );

		$canonical = new Redirection_Canonical( true, '', [], 'http://example.org' );
		$this->assertFalse( $canonical->get_redirect( 'http://example.org', '/request?arg=1' ) );
	}
	*/
}
