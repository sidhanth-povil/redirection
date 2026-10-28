<?php

class Grouped404ApiTest extends Redirection_Api_Test {
	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_404" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );
		$this->setNonce();
	}

	private function log404( $url, $referrer = '' ) {
		Red_404_Log::create( 'domain', $url, '1.1.1.1', [ 'referrer' => $referrer ] );
	}

	private function grouped( array $filter_by = [] ) {
		$response = $this->callApi( '404', [ 'groupBy' => 'url', 'filterBy' => $filter_by ] );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data()['items'];
	}

	private function age_all( $days ) {
		global $wpdb;

		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}redirection_404 SET created = %s", wp_date( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS ) ) );
	}

	public function testGroupedRowsCarryLastSeenAndTopReferrer() {
		$this->log404( '/missing', 'https://a.test/' );
		$this->log404( '/missing', 'https://b.test/' );
		$this->log404( '/missing', 'https://b.test/' );

		$row = $this->grouped()[0];

		$this->assertSame( '/missing', $row->url );
		$this->assertSame( 3, $row->count );
		$this->assertSame( 'https://b.test/', $row->referrer );
		$this->assertNotEmpty( $row->last_seen );
	}

	public function testSinceKeepsRecent404s() {
		$this->log404( '/old' );
		$this->age_all( 30 );
		$this->log404( '/new' );

		$this->assertSame( [ '/new' ], array_column( $this->grouped( [ 'since' => '7' ] ), 'url' ) );
		$this->assertCount( 2, $this->grouped() );
	}

	public function testIgnoredSplitsUrlsWithADoNothingRedirect() {
		$this->log404( '/ignored' );
		$this->log404( '/broken' );
		Red_Item::create(
			[
				'url' => '/ignored',
				'group_id' => Red_Group::create( 'ignore', 1 )->get_id(),
				'match_type' => 'url',
				'action_type' => 'nothing',
			]
		);

		$this->assertSame( [ '/broken' ], array_column( $this->grouped( [ 'ignored' => '0' ] ), 'url' ) );
		$this->assertSame( [ '/ignored' ], array_column( $this->grouped( [ 'ignored' => '1' ] ), 'url' ) );
	}

	public function testUrlsDifferingOnlyByCaseKeepTheirReferrer() {
		$this->log404( '/Foo', 'https://a.test/' );
		$this->log404( '/foo', 'https://a.test/' );

		$row = $this->grouped()[0];

		$this->assertSame( 'https://a.test/', $row->referrer );
		$this->assertNotEmpty( $row->last_seen );
	}

	public function testSuggestsTheClosestPublishedPage() {
		$this->set_permalink_structure( '/%postname%/' );
		self::factory()->post->create( [ 'post_name' => 'summer-sale', 'post_status' => 'publish', 'post_type' => 'page' ] );
		$this->log404( '/offers/summer-sale-2025/' );

		$this->assertSame( '/summer-sale/', $this->grouped()[0]->suggestion );
	}

	public function testSuggestsNothingForDraftsOrUnrelatedSlugs() {
		$this->set_permalink_structure( '/%postname%/' );
		self::factory()->post->create( [ 'post_name' => 'winter-sale', 'post_status' => 'draft' ] );
		self::factory()->post->create( [ 'post_name' => 'about', 'post_status' => 'publish' ] );
		$this->log404( '/winter-sale' );

		$this->assertSame( '', $this->grouped()[0]->suggestion );
	}
}
