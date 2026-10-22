<?php

class HealthApiTest extends Redirection_Api_Test {
	private $group;

	public function setUp(): void {
		parent::setUp();
		\Redirection\Database\DsrUpgrader::run();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_404" );

		$this->group = Red_Group::create( 'health', 1 );
		$this->setNonce();
	}

	private function create( $url, $target, array $extra = [] ) {
		return Red_Item::create(
			array_merge(
				[
					'url' => $url,
					'group_id' => $this->group->get_id(),
					'match_type' => 'url',
					'action_type' => 'url',
					'action_code' => 301,
					'action_data' => [ 'url' => $target ],
				],
				$extra
			)
		);
	}

	private function health() {
		$response = $this->callApi( 'health' );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data();
	}

	private function check( array $params ) {
		return $this->callApi( 'check', $params, 'POST' )->get_data();
	}

	private function of_type( array $health, $type ) {
		return array_values(
			array_filter(
				$health['attention'],
				function ( $item ) use ( $type ) {
					return $item['type'] === $type;
				}
			)
		);
	}

	public function testNormalisesCaseAndTrailingSlashToLinkAChain() {
		$first = $this->create( '/old', '/Middle/' );
		$this->create( '/middle', '/new' );

		$chains = $this->of_type( $this->health(), 'chain' );

		$this->assertCount( 1, $chains );
		$this->assertSame( $first->get_id(), $chains[0]['id'] );
		$this->assertSame( '/new', $chains[0]['final_target'] );
		$this->assertSame( '/old', $chains[0]['redirect']['url'] );
	}

	public function testSameHostAbsoluteTargetsCountButExternalOnesDoNot() {
		$this->create( '/a', home_url( '/b' ) );
		$this->create( '/b', 'https://elsewhere.test/c' );
		$this->create( '/x', 'https://elsewhere.test/b' );

		$health = $this->health();

		$this->assertSame( 1, $health['counts']['chains'] );
		$this->assertSame( [ '/a', '/b', 'https://elsewhere.test/c' ], $this->of_type( $health, 'chain' )[0]['path'] );
	}

	public function testIgnoresRegexWildcardDisabledAndExpiredRedirects() {
		$this->create( '/a', '/b' );
		$this->create( '/b.*', '/c', [ 'regex' => 1 ] );
		$this->create( '/b*', '/c' );
		$this->create( '/b', '/c' )->disable();
		$this->create( '/b', '/c', [ 'end_at' => '2000-01-01 00:00' ] );

		$this->assertSame( 0, $this->health()['counts']['chains'] );
	}

	public function testReportsLoopsFirstWithoutAFinalTarget() {
		$this->create( '/a', '/b' );
		$this->create( '/b', '/a' );
		$this->create( '/c', '/d' );
		$this->create( '/d', '/e' );

		$health = $this->health();

		$this->assertSame( 2, $health['counts']['loops'] );
		$this->assertSame( 'loop', $health['attention'][0]['type'] );
		$this->assertArrayNotHasKey( 'final_target', $health['attention'][0] );
	}

	public function testCountsAndListsRecentUnfixed404sByHits() {
		Red_404_Log::create( 'domain', '/missing', '1.1.1.1', [] );
		Red_404_Log::create( 'domain', '/missing', '1.1.1.2', [] );
		Red_404_Log::create( 'domain', '/fixed', '1.1.1.1', [] );
		Red_404_Log::create( 'domain', '/once', '1.1.1.1', [] );
		$this->create( '/fixed', '/somewhere' );

		$health = $this->health();
		$errors = $this->of_type( $health, '404' );

		$this->assertSame( 3, $health['counts']['new404s'] );
		$this->assertSame( [ '/missing', '/once' ], array_column( $errors, 'url' ) );
		$this->assertSame( 2, $errors[0]['hits'] );
	}

	public function testCountsActiveAndScheduledAndListsExpiringRedirects() {
		$soon = wp_date( 'Y-m-d H:i', time() + DAY_IN_SECONDS );
		$later = wp_date( 'Y-m-d H:i', time() + 30 * DAY_IN_SECONDS );

		$this->create( '/live', '/x' );
		$ending = $this->create( '/ending', '/x', [ 'end_at' => $soon ] );
		$this->create( '/starting', '/x', [ 'start_at' => $soon ] );
		$this->create( '/far', '/x', [ 'start_at' => $later ] );

		$health = $this->health();
		$expiring = $this->of_type( $health, 'expiring' );

		$this->assertSame( 2, $health['counts']['active'] );
		$this->assertSame( 2, $health['counts']['scheduled'] );
		$this->assertCount( 1, $expiring );
		$this->assertSame( $ending->get_id(), $expiring[0]['id'] );
	}

	public function testCheckStatuses() {
		$existing = $this->create( '/b', '/c' );
		$this->create( '/loop-back', '/new' );

		$this->assertSame( 'ok', $this->check( [ 'source' => '/new', 'target' => '/other' ] )['status'] );

		$chain = $this->check( [ 'source' => '/a', 'target' => '/B/' ] );
		$this->assertSame( 'chain', $chain['status'] );
		$this->assertSame( '/c', $chain['final_target'] );

		$this->assertSame( 'loop', $this->check( [ 'source' => '/new', 'target' => '/loop-back' ] )['status'] );

		$duplicate = $this->check( [ 'source' => '/b/', 'target' => '/z' ] );
		$this->assertSame( 'duplicate', $duplicate['status'] );
		$this->assertSame( $existing->get_id(), $duplicate['existing_id'] );

		$this->assertSame( 'ok', $this->check( [ 'source' => '/b', 'target' => '/z', 'id' => $existing->get_id() ] )['status'] );
		$this->assertSame( 'ok', $this->check( [ 'source' => '/b/*', 'target' => '/b' ] )['status'] );
	}

	public function testRequiresAccess() {
		$this->setUnauthorised();

		$this->assertSame( 403, $this->callApi( 'health' )->get_status() );
		$this->assertSame( 403, $this->callApi( 'check', [ 'source' => '/a', 'target' => '/b' ], 'POST' )->get_status() );
	}
}
