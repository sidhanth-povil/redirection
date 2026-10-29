<?php

use Redirection\Redirect\Tester;

class RedirectTestApiTest extends Redirection_Api_Test {
	private $group;
	private $requests = [];
	private $reply;
	private $by_url = [];

	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );

		$this->group = Red_Group::create( 'tester', 1 );
		$this->requests = [];
		add_filter( 'pre_http_request', [ $this, 'fake_http' ], 10, 3 );
		$this->setNonce();
	}

	public function tearDown(): void {
		remove_filter( 'pre_http_request', [ $this, 'fake_http' ], 10 );
		unset( $_SERVER['HTTP_X_DSR_TEST'] );
		parent::tearDown();
	}

	public function fake_http( $pre, $args, $url ) {
		$this->requests[] = [ 'url' => $url, 'args' => $args ];

		return $this->reply;
	}

	private function reply( $code, $location = '' ) {
		$this->reply = [
			'headers' => $location === '' ? [] : [ 'location' => $location ],
			'body' => '',
			'response' => [ 'code' => $code, 'message' => '' ],
			'cookies' => [],
			'filename' => null,
		];
	}

	private function create( $url, array $extra = [] ) {
		return Red_Item::create(
			array_merge(
				[
					'url' => $url,
					'group_id' => $this->group->get_id(),
					'match_type' => 'url',
					'action_type' => 'url',
					'action_code' => 302,
					'action_data' => [ 'url' => '/pricing/' ],
					'match_data' => [ 'source' => [ 'flag_query' => 'pass' ] ],
				],
				$extra
			)
		);
	}

	private function test_redirect( $item ) {
		return $this->callApi( 'redirect/' . $item->get_id() . '/test', [], 'POST' );
	}

	public function testReportsWhereARedirectGoesAndThatTrackingSurvives() {
		$item = $this->create( '/sale' );
		$this->reply( 302, home_url( '/pricing/?utm_source=dsr-test' ) );

		$result = $this->test_redirect( $item );

		$this->assertSame( 200, $result->get_status() );
		$data = $result->get_data();
		$this->assertSame( 302, $data['code'] );
		$this->assertSame( '/pricing/?utm_source=dsr-test', $data['location'] );
		$this->assertTrue( $data['utm_preserved'] );
		$this->assertTrue( $data['ok'] );
		$this->assertIsInt( $data['ms'] );

		$this->assertSame( home_url( '/sale?utm_source=dsr-test' ), $this->requests[0]['url'] );
		$this->assertSame( 0, $this->requests[0]['args']['redirection'] );
		$this->assertSame( Tester::token(), $this->requests[0]['args']['headers'][ Tester::HEADER ] );
	}

	public function testExactRedirectsAreRequestedWithoutExtraParameters() {
		// An extra parameter would stop an exact redirect matching at all.
		$item = $this->create( '/sale', [ 'match_data' => [ 'source' => [ 'flag_query' => 'exact' ] ] ] );
		$this->reply( 302, home_url( '/pricing/' ) );

		$data = $this->test_redirect( $item )->get_data();

		$this->assertSame( home_url( '/sale' ), $this->requests[0]['url'] );
		$this->assertNull( $data['utm_preserved'] );
		$this->assertTrue( $data['ok'] );
	}

	public function testFlagsARedirectThatDoesNotFire() {
		$item = $this->create( '/sale' );
		$this->reply( 404 );

		$data = $this->test_redirect( $item )->get_data();

		$this->assertSame( 404, $data['code'] );
		$this->assertFalse( $data['ok'] );
	}

	public function testGoneIsOkWithoutALocation() {
		$item = $this->create( '/old-promo', [ 'action_type' => 'error', 'action_code' => 410, 'action_data' => [] ] );
		$this->reply( 410 );

		$this->assertTrue( $this->test_redirect( $item )->get_data()['ok'] );
	}

	public function testReportsWhenTheSiteCannotReachItself() {
		$item = $this->create( '/sale' );
		$this->reply = new WP_Error( 'http_request_failed', 'cURL error 7: Failed to connect' );

		$result = $this->test_redirect( $item );

		$this->assertSame( 502, $result->get_status() );
		$this->assertStringContainsString( 'Failed to connect', $result->get_data()['message'] );
	}

	public function testRefusesPatternRedirects() {
		$item = $this->create( '/blog/*' );

		$this->assertSame( 400, $this->test_redirect( $item )->get_status() );
		$this->assertCount( 0, $this->requests );
	}

	public function testNeverRequestsAnotherHost() {
		global $wpdb;

		// Sources are always saved with a leading slash; a row written some other way must not change the host.
		$item = $this->create( '/sale' );
		$wpdb->update( $wpdb->prefix . 'redirection_items', [ 'url' => '@evil.example/x' ], [ 'id' => $item->get_id() ] );

		$this->assertSame( 400, $this->test_redirect( $item )->get_status() );
		$this->assertCount( 0, $this->requests );
	}

	public function testNeedsPermission() {
		$item = $this->create( '/sale' );
		$this->setUnauthorised();

		$this->assertSame( 403, $this->test_redirect( $item )->get_status() );
	}

	public function testTestRequestsDoNotCountAsHits() {
		global $wpdb;

		$item = $this->create( '/sale' );
		$_SERVER['HTTP_X_DSR_TEST'] = Tester::token();

		Red_Item::get_by_id( $item->get_id() )->visit( '/sale', '/pricing/' );

		$this->assertSame( '0', $wpdb->get_var( $wpdb->prepare( "SELECT last_count FROM {$wpdb->prefix}redirection_items WHERE id=%d", $item->get_id() ) ) );
	}

	public function testOldTokensStopWorking() {
		// A token seen once (in a proxy log, say) must not hide visits forever.
		$this->assertTrue( Tester::is_valid_token( Tester::token() ) );
		$this->assertTrue( Tester::is_valid_token( Tester::token( time() - Tester::TOKEN_WINDOW ) ) );
		$this->assertFalse( Tester::is_valid_token( Tester::token( time() - 3 * Tester::TOKEN_WINDOW ) ) );
		$this->assertFalse( Tester::is_valid_token( Tester::token( time() - HOUR_IN_SECONDS ) ) );
		$this->assertFalse( Tester::is_valid_token( '' ) );
	}

	private function replies( array $by_url ) {
		$this->by_url = $by_url;
		remove_filter( 'pre_http_request', [ $this, 'fake_http' ], 10 );
		add_filter( 'pre_http_request', [ $this, 'fake_http_by_url' ], 10, 3 );
	}

	public function fake_http_by_url( $pre, $args, $url ) {
		$this->requests[] = [ 'url' => $url, 'args' => $args ];
		$path = (string) wp_parse_url( $url, PHP_URL_PATH );
		[ $code, $location ] = $this->by_url[ $path ] ?? [ 404, '' ];

		return [
			'headers' => $location === '' ? [] : [ 'location' => $location ],
			'body' => '',
			'response' => [ 'code' => $code, 'message' => '' ],
			'cookies' => [],
			'filename' => null,
		];
	}

	private function trace( $url ) {
		$result = $this->callApi( 'redirect/trace', [ 'url' => $url ], 'POST' );
		remove_filter( 'pre_http_request', [ $this, 'fake_http_by_url' ], 10 );

		return $result;
	}

	public function testTraceFollowsEveryHopOnThisSite() {
		$this->replies( [ '/a' => [ 301, home_url( '/b' ) ], '/b' => [ 302, '/c/' ], '/c/' => [ 200, '' ] ] );

		$result = $this->trace( home_url( '/a' ) );

		$this->assertSame( 200, $result->get_status() );
		$this->assertSame(
			[ [ '/a', 301, '/b' ], [ '/b', 302, '/c/' ], [ '/c/', 200, '' ] ],
			array_map( fn( $hop ) => [ $hop['url'], $hop['code'], $hop['location'] ], $result->get_data()['hops'] )
		);
		$this->assertSame( Tester::token(), $this->requests[0]['args']['headers'][ Tester::HEADER ] );
	}

	public function testTraceNeverRequestsAnotherSite() {
		$this->replies( [ '/out' => [ 301, 'https://other.example/landing' ] ] );

		$hops = $this->trace( home_url( '/out' ) )->get_data()['hops'];

		$this->assertCount( 1, $this->requests );
		$this->assertSame( 'https://other.example/landing', $hops[0]['location'] );
		$this->assertTrue( $hops[0]['external'] );
	}

	public function testTraceRefusesAnotherSitesUrl() {
		$this->replies( [] );

		$this->assertSame( 400, $this->trace( 'https://other.example/x' )->get_status() );
		$this->assertCount( 0, $this->requests );
	}

	public function testTraceStopsAtALoop() {
		$this->replies( [ '/x' => [ 301, '/y' ], '/y' => [ 301, '/x' ] ] );

		$data = $this->trace( '/x' )->get_data();

		$this->assertCount( 2, $data['hops'] );
		$this->assertTrue( $data['loop'] );
	}
}
