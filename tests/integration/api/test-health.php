<?php

class HealthApiTest extends Redirection_Api_Test {
	private $group;

	public function setUp(): void {
		parent::setUp();
		\Redirection\Database\DsrUpgrader::run();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_404" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_logs" );

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
		$this->assertSame( 403, $this->callApi( 'health/traffic', [ 'days' => 7 ] )->get_status() );
	}

	public function testQueryStringsAreNotFollowed() {
		$this->create( '/b', '/a?ref=x' );
		$this->create( '/a', '/c' );
		$this->create( '/page?lang=fr', '/fr' );
		$this->create( '/x', '/page' );

		$this->assertSame( 0, $this->health()['counts']['chains'] );
		$this->assertSame( 'ok', $this->check( [ 'source' => '/shop', 'target' => '/shop?view=grid' ] )['status'] );
		$this->assertSame( 'ok', $this->check( [ 'source' => '/page?lang=de', 'target' => '/de' ] )['status'] );
	}

	public function testWwwAndBareHostAreTheSameSite() {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		$this->create( '/a', 'http://www.' . $host . '/b' );
		$this->create( '/b', '/c' );

		$this->assertSame( 1, $this->health()['counts']['chains'] );
	}

	public function testRanksByGroupSoRecent404sAreNotBuriedByOldChains() {
		Red_404_Log::create( 'domain', '/missing', '1.1.1.1', [] );
		$this->create( '/a', '/b', [ 'hits' => 9999 ] );
		$this->create( '/b', '/c' );

		$this->assertSame( [ '404', 'chain' ], array_column( $this->health()['attention'], 'type' ) );
	}

	/**
	 * A log row at a site-local time, as the loggers store it (current_time( 'mysql' )).
	 */
	private function log( $table, $days_ago, $redirect_id = 0, $time = '12:00:00' ) {
		global $wpdb;

		$row = [
			'created' => wp_date( 'Y-m-d', time() - $days_ago * DAY_IN_SECONDS ) . ' ' . $time,
			'url' => '/logged',
		];

		if ( $table === 'redirection_logs' ) {
			$row['redirection_id'] = $redirect_id;
		}

		$wpdb->insert( $wpdb->prefix . $table, $row );
	}

	private function traffic( $days ) {
		$response = $this->callApi( 'health/traffic', [ 'days' => $days ] );
		$this->assertSame( 200, $response->get_status() );

		return $response->get_data();
	}

	public function testTrafficIsOneZeroFilledRowPerSiteDayOldestFirst() {
		update_option( 'timezone_string', 'Pacific/Auckland' );
		$this->log( 'redirection_logs', 0, 1, '00:30:00' );
		$this->log( 'redirection_logs', 0, 1 );
		$this->log( 'redirection_logs', 2, 1 );
		$this->log( 'redirection_404', 0 );
		$this->log( 'redirection_logs', 8, 1 );

		$week = $this->traffic( 7 )['days'];

		$this->assertCount( 7, $week );
		$this->assertSame( wp_date( 'Y-m-d' ), $week[6]['date'] );
		$this->assertSame( wp_date( 'Y-m-d', time() - 6 * DAY_IN_SECONDS ), $week[0]['date'] );
		$this->assertSame( [ 'date' => wp_date( 'Y-m-d' ), 'redirects' => 2, 'errors' => 1 ], $week[6] );
		$this->assertSame( 1, $week[4]['redirects'] );
		$this->assertSame( 3, array_sum( array_column( $week, 'redirects' ) ) );

		$month = $this->traffic( 30 )['days'];
		$this->assertCount( 30, $month );
		$this->assertSame( 4, array_sum( array_column( $month, 'redirects' ) ) );
	}

	public function testTrafficOnlyOffersSevenOrThirtyDays() {
		$this->assertSame( 400, $this->callApi( 'health/traffic', [ 'days' => 14 ] )->get_status() );
	}

	public function testTrafficListsTopRedirectsByHitsInTheWindow() {
		$quiet = $this->create( '/quiet', '/a', [ 'hits' => 500 ] );
		$busy = $this->create( '/busy', '/b' );
		$this->log( 'redirection_logs', 1, $quiet->get_id() );
		$this->log( 'redirection_logs', 20, $quiet->get_id() );
		$this->log( 'redirection_logs', 20, $quiet->get_id() );
		$this->log( 'redirection_logs', 0, $busy->get_id() );
		$this->log( 'redirection_logs', 1, $busy->get_id() );
		$this->log( 'redirection_logs', 1, 0 );

		$top = $this->traffic( 7 )['top'];

		$this->assertSame( [ $busy->get_id(), $quiet->get_id() ], array_column( $top, 'id' ) );
		$this->assertSame( [ 2, 1 ], array_column( $top, 'hits' ) );
		$this->assertSame( '/busy', $top[0]['redirect']['url'] );
		$this->assertSame( [ $quiet->get_id(), $busy->get_id() ], array_column( $this->traffic( 30 )['top'], 'id' ) );
	}

	public function testTrafficReportsLogRetention() {
		Red_Options::save( [ 'expire_redirect' => -1, 'expire_404' => 30 ] );

		$this->assertSame( [ 'redirect' => -1, 'error' => 30 ], $this->traffic( 7 )['retention'] );
	}

	public function testCountsRedirectsWithNoHitInAYear() {
		global $wpdb;

		$this->create( '/never', '/a' );
		$stale = $this->create( '/stale', '/b' );
		$recent = $this->create( '/recent', '/c' );
		$wpdb->update( "{$wpdb->prefix}redirection_items", [ 'last_access' => gmdate( 'Y-m-d H:i:s', time() - 400 * DAY_IN_SECONDS ) ], [ 'id' => $stale->get_id() ] );
		$wpdb->update( "{$wpdb->prefix}redirection_items", [ 'last_access' => gmdate( 'Y-m-d H:i:s' ) ], [ 'id' => $recent->get_id() ] );

		$this->assertSame( 2, $this->health()['counts']['unused'] );
	}
}
