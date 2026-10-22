<?php

class WildcardRedirectsTest extends Redirection_Api_Test {
	private $group;

	public function setUp(): void {
		parent::setUp();
		\Redirection\Database\DsrUpgrader::run();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );

		$this->group = Red_Group::create( 'sections', 1 );
	}

	private function create( $url, $target, array $source = [] ) {
		return Red_Item::create(
			[
				'url' => $url,
				'group_id' => $this->group->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_code' => 301,
				'action_data' => [ 'url' => $target ],
				'match_data' => [ 'source' => array_merge( [ 'flag_regex' => false ], $source ) ],
			]
		);
	}

	private function target_for( $url ) {
		foreach ( Red_Item::get_for_matched_url( $url ) as $item ) {
			$action = $item->get_match( $url );

			if ( $action !== false ) {
				return $action->get_target();
			}
		}

		return false;
	}

	public function testSectionWildcardRedirectsEverythingUnderIt() {
		$redirect = $this->create( '/blog/*', '/news/*' );

		$this->assertTrue( $redirect->is_wildcard() );
		$this->assertSame( '/news/2024/hello', $this->target_for( '/blog/2024/hello' ) );
		$this->assertFalse( $this->target_for( '/about' ) );
	}

	public function testMultipleWildcards() {
		$this->create( '/shop/*/item-*', '/products/*/*' );

		$this->assertSame( '/products/shoes/42', $this->target_for( '/shop/shoes/item-42' ) );
	}

	public function testSpecialCharactersAreLiteral() {
		$this->create( '/a.b/(x)/*', '/ok/*' );

		$this->assertSame( '/ok/z', $this->target_for( '/a.b/(x)/z' ) );
		$this->assertFalse( $this->target_for( '/axb/(x)/z' ) );
	}

	public function testHonoursIgnoreCase() {
		$this->create( '/Promo/*', '/sale/*', [ 'flag_case' => true ] );

		$this->assertSame( '/sale/x', $this->target_for( '/promo/x' ) );
	}

	public function testRejectsRegexAndWildcardTogether() {
		$this->setNonce();

		$result = $this->callApi(
			'redirect',
			[
				'url' => '/both/*',
				'group_id' => $this->group->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_code' => 301,
				'action_data' => [ 'url' => '/t' ],
				'match_data' => [ 'source' => [ 'flag_regex' => true, 'flag_wildcard' => true ] ],
			],
			'POST'
		);

		$this->assertSame( 400, $result->get_status() );
	}

	public function testStoredUpstreamPlainStarRowStillMatchesLiterally() {
		global $wpdb;

		// Saved by upstream Redirection before wildcards existed: plain source with a literal *.
		$wpdb->insert(
			$wpdb->prefix . 'redirection_items',
			[
				'url' => '/literal*star',
				'match_url' => ( new \Redirection\Url\Matcher( '/literal*star' ) )->get_url(),
				'regex' => 0,
				'group_id' => $this->group->get_id(),
				'status' => 'enabled',
				'action_type' => 'url',
				'action_code' => 301,
				'action_data' => '/kept',
				'match_type' => 'url',
			]
		);

		$this->assertSame( '/kept', $this->target_for( '/literal*star' ) );
		$this->assertFalse( $this->target_for( '/literalXXstar' ) );
	}

	public function testJsonDescribesAWildcardNotARegex() {
		$redirect = $this->create( '/blog/*', '/news/*' );
		$json = Red_Item::get_by_id( $redirect->get_id() )->to_json();

		$this->assertTrue( $json['match_data']['source']['flag_wildcard'] );
		$this->assertFalse( $json['match_data']['source']['flag_regex'] );
		$this->assertSame( '/blog/*', $json['url'] );
	}
}
