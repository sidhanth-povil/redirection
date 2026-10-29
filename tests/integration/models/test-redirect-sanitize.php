<?php

class RedirectSanitizeTest extends WP_UnitTestCase {
	/**
	 * @var Red_Item_Sanitize
	 */
	private $sanitizer;

	/**
	 * @var Red_Group
	 */
	private $group;

	public function setUp(): void {
		parent::setUp();

		// Ensure options database value exists with defaults
		delete_option( Red_Options::OPTION_KEY );
		Red_Options::save( [ 'flag_case' => false, 'flag_trailing' => false ] );

		$this->sanitizer = new Red_Item_Sanitize();
		$this->group = Red_Group::create( 'group', 1 );
	}

	private function get_new( array $extra = array() ) {
		return array_merge( [
			'url' => '/a',
			'group_id' => $this->group->get_id(),
			'match_type' => 'url',
			'action_type' => 'url',
		], $extra );
	}

	public function testRemoveHttp() {
		$this->assertEquals( '/some/url', $this->sanitizer->sanitize_url( 'http://domain.com/some/url' ) );
		$this->assertEquals( '/some/url', $this->sanitizer->sanitize_url( 'https://domain.com/some/url' ) );
	}

	public function testRemoveNewline() {
		$this->assertEquals( '/some/url', $this->sanitizer->sanitize_url( "/some/url\nsomethingelse1" ) );
		$this->assertEquals( '/some/url', $this->sanitizer->sanitize_url( "/some/url\rsomethingelse2" ) );
		$this->assertEquals( '/some/url', $this->sanitizer->sanitize_url( "/some/url\r\nsomethingelse3" ) );
	}

	public function testAddLeadingSlash() {
		$this->assertEquals( '/some/url', $this->sanitizer->sanitize_url( 'some/url' ) );
	}

	public function testDecodePath() {
		$this->assertEquals( '/中国/thing?other=中国', $this->sanitizer->sanitize_url( '/%E4%B8%AD%E5%9B%BD/thing?other=%E4%B8%AD%E5%9B%BD' ) );
	}

	// Note this also checks a good URL, good match, good group, and good action
	public function testTrim() {
		$result = $this->sanitizer->get( $this->get_new( array( 'url' => ' /spaces   ' ) ) );
		$this->assertEquals( '/spaces', $result['url'] );
	}

	public function testStripSlashes() {
		$result = $this->sanitizer->get( $this->get_new( array( 'url' => '/spaces\'' ) ) );
		$this->assertEquals( "/spaces'", $result['url'] );
	}

	public function testPlusChar() {
		$result = $this->sanitizer->get( $this->get_new( array( 'url' => '/test(.+)' ) ) );
		$this->assertEquals( '/test(.+)', $result['url'] );
	}

	public function testBadRegex() {
		$result = $this->sanitizer->get( $this->get_new( array( 'regex' => 'cat' ) ) );
		$this->assertEquals( 0, $result['regex'] );
	}

	public function testGoodRegex() {
		$result = $this->sanitizer->get( $this->get_new( array( 'regex' => true, 'url' => '^/a$' ) ) );
		$this->assertEquals( 1, $result['regex'] );
	}

	public function testNoTitleNull() {
		$result = $this->sanitizer->get( $this->get_new( array() ) );
		$this->assertNull( $result['title'] );
	}

	public function testTitle() {
		$result = $this->sanitizer->get( $this->get_new( array( 'title' => 'title' ) ) );
		$this->assertEquals( 'title', $result['title'] );
	}

	public function testLongTitle() {
		$title = str_repeat( 'a', 501 );
		$result = $this->sanitizer->get( $this->get_new( array( 'title' => $title ) ) );
		$this->assertEquals( substr( $title, 0, 500 ), $result['title'] );
	}

	public function testEmptyUrl() {
		$result = $this->sanitizer->get( $this->get_new( array( 'url' => '' ) ) );
		$this->assertEquals( '/', $result['url'] );
	}

	public function testEmptyUrlRegex() {
		$result = $this->sanitizer->get( $this->get_new( array( 'url' => '', 'regex' => true ) ) );
		$this->assertWPError( $result );
	}

	public function testUrl() {
		$result = $this->sanitizer->get( $this->get_new() );
		$this->assertEquals( '/a', $result['url'] );
	}

	public function testBadGroup() {
		$result = $this->sanitizer->get( $this->get_new( array( 'group_id' => 'cat' ) ) );
		$this->assertWPError( $result );
	}

	public function testBadMatch() {
		$result = $this->sanitizer->get( $this->get_new( array( 'match_type' => 'cat' ) ) );
		$this->assertWPError( $result );

		$result = $this->sanitizer->get( $this->get_new( array( 'match_type' => '' ) ) );
		$this->assertWPError( $result );
	}

	public function testBadRedirectCode() {
		$result = $this->sanitizer->get( $this->get_new( array( 'action_code' => 'cat' ) ) );
		$this->assertEquals( 301, $result['action_code'] );

		$result = $this->sanitizer->get( $this->get_new( array( 'action_code' => '404' ) ) );
		$this->assertEquals( 301, $result['action_code'] );
	}

	public function testGoodRedirectCode() {
		$result = $this->sanitizer->get( $this->get_new( array( 'action_code' => '301' ) ) );
		$this->assertEquals( 301, $result['action_code'] );
	}

	public function testBadErrorCode() {
		$result = $this->sanitizer->get( $this->get_new( array( 'action_code' => '301', 'action_type' => 'error' ) ) );
		$this->assertEquals( 404, $result['action_code'] );
	}

	public function testGoodErrorCode() {
		$result = $this->sanitizer->get( $this->get_new( array( 'action_code' => '404', 'action_type' => 'error' ) ) );
		$this->assertEquals( 404, $result['action_code'] );
	}

	public function testBadActionTYPE() {
		$result = $this->sanitizer->get( $this->get_new( array( 'action_type' => 'cats' ) ) );
		$this->assertWPError( $result );
	}

	public function testUnserializeData() {
		$result = $this->sanitizer->get( $this->get_new( array( 'action_data' => array( 'url' => '/a' ) ) ) );
		$this->assertEquals( '/a', $result['action_data'] );
	}

	public function testStripSlasheserializeData() {
		$result = $this->sanitizer->get( $this->get_new( [
			'match_type' => 'login',
			'action_data' => [
				'logged_in' => '',
				'logged_out' => '',
			],
		] ) );
		$this->assertEquals( serialize( [
			'logged_in' => '',
			'logged_out' => '',
		] ), $result['action_data'] );
	}

	public function testBadPosition() {
		$result = $this->sanitizer->get( $this->get_new( array( 'position' => 'cat' ) ) );
		$this->assertEquals( 0, $result['position'] );

		$result = $this->sanitizer->get( $this->get_new( array( 'position' => -1 ) ) );
		$this->assertEquals( 0, $result['position'] );
	}

	public function testGoodPosition() {
		$result = $this->sanitizer->get( $this->get_new( array( 'position' => 6 ) ) );
		$this->assertEquals( 6, $result['position'] );
	}

	public function testAbsoluteUrl() {
		$result = $this->sanitizer->get( $this->get_new( array( 'url' => 'http://full.com' ) ) );

		$this->assertEquals( 'server', $result['match_type'] );
		$this->assertEquals( '/', $result['url'] );
		$this->assertEquals( 'http://full.com', unserialize( $result['action_data'] )['server'] );
	}

	public function testSourceFlags() {
		$flags = [ 'source' => [ 'flag_case' => true ] ];
		$result = $this->sanitizer->get( $this->get_new( [ 'match_data' => $flags ] ) );

		$this->assertEquals( $flags['source']['flag_case'], $result['match_data']['source']['flag_case'] );
	}

	public function testSourceFlagsRegexOverride() {
		$flags = [ 'regex' => true, 'url' => '^/a$' ];
		$result = $this->sanitizer->get( $this->get_new( $flags ) );

		$this->assertEquals( 1, $result['regex'] );
		$this->assertEquals( 'regex', $result['match_url'] );
		$this->assertTrue( $result['match_data']['source']['flag_regex'] );
	}

	public function testMatchUrlSet() {
		$result = $this->sanitizer->get( $this->get_new( [ 'url' => '/TEST/?thing=1' ] ) );

		$this->assertEquals( '/test', $result['match_url'] );
	}

	public function testMatchUrlSanitize() {
		$result = $this->sanitizer->get( $this->get_new( [ 'url' => 'url' ] ) );

		$this->assertEquals( '/url', $result['match_url'] );
		$this->assertEquals( '/url', $result['url'] );
	}

	public function testMatchUrlSetRegex() {
		$result = $this->sanitizer->get( $this->get_new( [ 'url' => '/test', 'regex' => true ] ) );

		$this->assertEquals( 'regex', $result['match_url'] );
	}

	public function testRegexFlagsSetColumn() {
		red_set_options( [ 'flag_case' => false, 'flag_regex' => false, 'flag_query' => 'exact', 'flag_trailing' => false ] );
		$result = $this->sanitizer->get( $this->get_new( [ 'url' => '/test', 'match_data' => [ 'source' => [ 'flag_regex' => true ] ] ] ) );

		$this->assertEquals( 'regex', $result['match_url'] );
		$this->assertEquals( 1, $result['regex'] );
	}

	public function testGetJsonDefaultSame() {
		red_set_options( [ 'flag_case' => true, 'flag_regex' => false, 'flag_query' => 'exact', 'flag_trailing' => false ] );

		$flags = [ 'source' => [ 'flag_case' => true, 'flag_regex' => false, 'flag_query' => 'exact', 'flag_trailing' => false ] ];
		$result = $this->sanitizer->get( $this->get_new( [ 'match_data' => $flags ] ) );
		$this->assertTrue( ! isset( $result['match_data'] ) );
	}

	public function testGetJsonDefaultDifferent() {
		red_set_options( [ 'flag_case' => false, 'flag_regex' => false, 'flag_query' => 'exact', 'flag_trailing' => false ] );

		$flags = [ 'source' => [ 'flag_case' => true, 'flag_query' => 'ignore', 'flag_trailing' => true ] ];
		$result = $this->sanitizer->get( $this->get_new( [ 'match_data' => $flags ] ) );

		$this->assertEquals( $flags['source'], $result['match_data']['source'] );
	}

	private function asUserWithoutUnfilteredHtml() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$deny = function ( $caps, $cap ) {
			return $cap === 'unfiltered_html' ? [ 'do_not_allow' ] : $caps;
		};
		add_filter( 'map_meta_cap', $deny, 10, 2 );

		return $deny;
	}

	public function testPassThroughNeedsUnfilteredHtml() {
		$deny = $this->asUserWithoutUnfilteredHtml();

		$external = $this->sanitizer->get( $this->get_new( [ 'action_type' => 'pass', 'action_data' => [ 'url' => 'https://example.org/p.html' ] ] ) );
		$capture = $this->sanitizer->get( $this->get_new( [ 'url' => '^/p/(.*)', 'regex' => true, 'action_type' => 'pass', 'action_data' => [ 'url' => '$1' ] ] ) );

		remove_filter( 'map_meta_cap', $deny, 10 );

		// A regex target can become external when the request is replaced in, so every pass-through is gated
		$this->assertWPError( $external );
		$this->assertWPError( $capture );
	}

	public function testPassThroughAllowedWithUnfilteredHtml() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		if ( is_multisite() ) {
			grant_super_admin( get_current_user_id() );
		}

		$result = $this->sanitizer->get( $this->get_new( [ 'action_type' => 'pass', 'action_data' => [ 'url' => 'https://example.org/p.html' ] ] ) );

		$this->assertFalse( is_wp_error( $result ) );
		$this->assertEquals( 'pass', $result['action_type'] );
	}

	public function testNonUrlMatchWithoutDataClearsStoredTarget() {
		// A match type change must not keep the previous matcher's raw target, which would be unserialized as match data
		$result = $this->sanitizer->get( $this->get_new( [ 'match_type' => 'login' ] ) );

		$this->assertArrayHasKey( 'action_data', $result );
		$this->assertNull( $result['action_data'] );
	}

	public function testRefusesProtectedPaths() {
		// A plain source, a wildcard and a regex that would each lock the team out.
		foreach ( [ [ '/wp-login.php', 0 ], [ '/wp-*', 0 ], [ '^/(.*)$', 1 ] ] as [ $url, $regex ] ) {
			$result = $this->sanitizer->get( $this->get_new( [ 'url' => $url, 'regex' => $regex ] ) );

			$this->assertWPError( $result, $url );
		}
	}

	public function testAllowsPathsThatOnlyLookProtected() {
		$result = $this->sanitizer->get( $this->get_new( [ 'url' => '/wp-admin-guide' ] ) );

		$this->assertSame( '/wp-admin-guide', $result['url'] );
	}

	public function testProtectedPathsCanBeExtended() {
		$add = function ( $paths ) {
			return array_merge( $paths, [ '/members' ] );
		};
		add_filter( 'dsr_protected_paths', $add );

		$result = $this->sanitizer->get( $this->get_new( [ 'url' => '/members/area' ] ) );
		remove_filter( 'dsr_protected_paths', $add );

		$this->assertWPError( $result );
	}

	public function testDoubleEncodedSourcesNeverReachAProtectedPath() {
		// Whatever is saved (refused, or with its stray octets stripped) must not match the page it disguises.
		$cases = [ [ '/wp-%256Cogin.php', 0 ], [ '/WP-%254Cogin.php', 0 ], [ '/wp-admin%252F', 0 ], [ '^/wp-%256Cogin\\.php$', 1 ] ];

		foreach ( $cases as [ $url, $regex ] ) {
			$result = $this->sanitizer->get( $this->get_new( [ 'url' => $url, 'regex' => $regex ] ) );
			if ( is_wp_error( $result ) ) {
				continue;
			}

			$matcher = $regex === 1 ? new \Redirection\Core\Regex( $result['url'], true ) : null;
			$this->assertNull( \Redirection\Url\ProtectedPaths::find_blocked( $result['url'], $matcher, \Redirection\Url\ProtectedPaths::DEFAULTS ), $url );
			$this->assertNotSame( '/wp-login.php', $result['match_url'], $url );
		}
	}
}
