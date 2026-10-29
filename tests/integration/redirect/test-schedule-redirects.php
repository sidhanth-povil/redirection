<?php

use Redirection\ImportExport\Format\Apache;
use Redirection\ImportExport\Format\Csv;
use Redirection\ImportExport\Format\Nginx;
use Redirection\ImportExport\Format\RedirectsFile;
use Redirection\Redirect\Cache;

class ScheduleRedirectsTest extends Redirection_Api_Test {
	private $group;

	public function setUp(): void {
		parent::setUp();

		// Other suites reinstall the tables without DSuite columns; admin_init does this on a real site.
		\Redirection\Database\DsrUpgrader::run();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );

		$this->group = Red_Group::create( 'campaigns', 1 );
		update_option( 'timezone_string', 'Asia/Kolkata' );
	}

	public function tearDown(): void {
		Red_Options::save( [ 'cache_key' => 0 ] );
		Cache::init()->reset();
		update_option( 'timezone_string', '' );
		parent::tearDown();
	}

	private function create( $url, array $extra = [] ) {
		return Red_Item::create(
			array_merge(
				[
					'url' => $url,
					'group_id' => $this->group->get_id(),
					'match_type' => 'url',
					'action_type' => 'url',
					'action_code' => 301,
					'action_data' => [ 'url' => '/target' ],
				],
				$extra
			)
		);
	}

	private function utc( $offset ) {
		return gmdate( 'Y-m-d\TH:i:s\Z', time() + $offset );
	}

	private function matched_urls( $url ) {
		return array_map( fn( $redirect ) => $redirect->get_url(), Red_Item::get_for_matched_url( $url ) );
	}

	private function row( $url ) {
		global $wpdb;

		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}redirection_items WHERE url=%s", $url ) );
	}

	public function testOnlyMatchesInsideItsWindow() {
		$this->create( '/future', [ 'start_at' => $this->utc( HOUR_IN_SECONDS ) ] );
		$this->create( '/past', [ 'end_at' => $this->utc( -HOUR_IN_SECONDS ) ] );
		$this->create( '/now', [ 'start_at' => $this->utc( -HOUR_IN_SECONDS ), 'end_at' => $this->utc( HOUR_IN_SECONDS ) ] );
		$this->create( '/plain' );

		$this->assertSame( [], $this->matched_urls( '/future' ) );
		$this->assertSame( [], $this->matched_urls( '/past' ) );
		$this->assertSame( [ '/now' ], $this->matched_urls( '/now' ) );
		$this->assertSame( [ '/plain' ], $this->matched_urls( '/plain' ) );
	}

	public function testDoesNotCacheLookupsWithScheduledCandidates() {
		Red_Options::save( [ 'cache_key' => 1 ] );
		Cache::init()->reset();

		// A catch-all that would answer /promo until the scheduled exact redirect starts.
		$this->create( '^/promo.*', [ 'regex' => 1, 'action_data' => [ 'url' => '/catch-all' ] ] );
		$this->create( '/promo', [ 'start_at' => $this->utc( HOUR_IN_SECONDS ) ] );

		$items = Red_Item::get_for_matched_url( '/promo' );
		$this->assertSame( [ '^/promo.*' ], array_map( fn( $redirect ) => $redirect->get_url(), $items ) );

		$cache = Cache::init();
		$this->assertFalse( $cache->set( '/promo', $items[0], $items ) );
		$this->assertFalse( $cache->get( '/promo' ) );

		// Lookups with no scheduled candidates still cache.
		$other = Red_Item::get_for_matched_url( '/other' );
		$this->assertTrue( $cache->set( '/other', false, $other ) );
	}

	public function testCreateViaRestReturnsScheduleInSiteTime() {
		$this->setNonce();

		$result = $this->callApi(
			'redirect',
			[
				'url' => '/black-friday',
				'group_id' => $this->group->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_code' => 302,
				'action_data' => [ 'url' => '/sale' ],
				'start_at' => '2030-11-28T09:00',
				'end_at' => '2030-12-02T09:00',
			],
			'POST'
		);

		$this->assertSame( 200, $result->get_status() );

		$row = $this->row( '/black-friday' );
		$this->assertSame( '2030-11-28 03:30:00', $row->start_at );
		$this->assertSame( '2030-12-02 03:30:00', $row->end_at );

		$json = Red_Item::get_by_id( intval( $row->id ) )->to_json();
		$this->assertSame( '2030-11-28T09:00:00+05:30', $json['start_at'] );
		$this->assertSame( '2030-12-02T09:00:00+05:30', $json['end_at'] );
		$this->assertSame( 'scheduled', $json['schedule_state'] );
	}

	public function testRejectsAnEndBeforeTheStart() {
		$this->setNonce();

		$params = [
			'url' => '/bad-window',
			'group_id' => $this->group->get_id(),
			'match_type' => 'url',
			'action_type' => 'url',
			'action_code' => 301,
			'action_data' => [ 'url' => '/t' ],
			'start_at' => '2030-12-02T09:00',
			'end_at' => '2030-11-28T09:00',
		];

		$result = $this->callApi( 'redirect', $params, 'POST' );
		$this->assertSame( 400, $result->get_status() );
		$this->assertSame( 'redirect_schedule', $result->as_error()->get_error_code() );

		$result = $this->callApi( 'redirect', array_merge( $params, [ 'end_at' => 'whenever' ] ), 'POST' );
		$this->assertSame( 400, $result->get_status() );
		$this->assertNull( $this->row( '/bad-window' ) );
	}

	public function testUpdateWithoutScheduleKeysKeepsIt() {
		$redirect = $this->create( '/keep', [ 'end_at' => '2030-01-01T00:00:00Z' ] );

		$redirect->update(
			[
				'url' => '/keep',
				'group_id' => $this->group->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_code' => 301,
				'action_data' => [ 'url' => '/elsewhere' ],
			]
		);
		$this->assertSame( '2030-01-01 00:00:00', $this->row( '/keep' )->end_at );

		$redirect->update(
			[
				'url' => '/keep',
				'group_id' => $this->group->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_code' => 301,
				'action_data' => [ 'url' => '/elsewhere' ],
				'end_at' => '',
			]
		);
		$this->assertNull( $this->row( '/keep' )->end_at );
	}

	public function testScheduleFilter() {
		$this->create( '/f-scheduled', [ 'start_at' => $this->utc( DAY_IN_SECONDS ) ] );
		$this->create( '/f-expired', [ 'end_at' => $this->utc( -DAY_IN_SECONDS ) ] );
		$this->create( '/f-live', [ 'end_at' => $this->utc( DAY_IN_SECONDS ) ] );
		$this->create( '/f-plain' );

		$urls = function ( $schedule ) {
			$result = Red_Item::get_filtered( [ 'filterBy' => [ 'schedule' => $schedule ] ] );
			$found = array_map( fn( $item ) => $item['url'], $result['items'] );
			sort( $found );

			return $found;
		};

		$this->assertSame( [ '/f-scheduled' ], $urls( 'scheduled' ) );
		$this->assertSame( [ '/f-expired' ], $urls( 'expired' ) );
		$this->assertSame( [ '/f-live', '/f-plain' ], $urls( 'live' ) );
	}

	public function testServerConfigExportSkipsScheduledRedirects() {
		$this->create( '/server-plain' );
		$this->create( '/server-scheduled', [ 'start_at' => $this->utc( DAY_IN_SECONDS ) ] );
		$items = [ Red_Item::get_by_id( intval( $this->row( '/server-plain' )->id ) ), Red_Item::get_by_id( intval( $this->row( '/server-scheduled' )->id ) ) ];

		foreach ( [ new Apache(), new Nginx(), new RedirectsFile() ] as $format ) {
			$output = $format->get_data( $items, [] );

			$this->assertStringContainsString( 'server-plain', $output );
			$this->assertStringNotContainsString( 'server-scheduled', $output );
		}
	}

	public function testRefusesDatesItCannotStore() {
		// Columns not added yet (e.g. right after the welcome wizard): saving must not drop the dates silently.
		delete_option( \Redirection\Redirect\Schedule::VERSION_OPTION );

		$result = $this->create( '/too-early', [ 'start_at' => $this->utc( DAY_IN_SECONDS ) ] );

		$this->assertWPError( $result );
		$this->assertSame( 'redirect_schedule', $result->get_error_code() );
		$this->assertInstanceOf( Red_Item::class, $this->create( '/no-dates', [ 'start_at' => '', 'end_at' => null ] ) );
	}

	public function testCsvExportCarriesTheSchedule() {
		$this->create( '/csv-campaign', [ 'start_at' => '2030-11-28T09:00', 'end_at' => '2030-12-02T09:00' ] );
		$this->create( '/csv-plain' );
		$items = [ Red_Item::get_by_id( intval( $this->row( '/csv-campaign' )->id ) ), Red_Item::get_by_id( intval( $this->row( '/csv-plain' )->id ) ) ];

		$lines = explode( PHP_EOL, trim( ( new Csv() )->get_data( $items, [] ) ) );

		$this->assertStringEndsWith( ',title,status,start_at,end_at', $lines[0] );
		$this->assertStringEndsWith( ',"2030-11-28T09:00:00+05:30","2030-12-02T09:00:00+05:30"', $lines[1] );
		$this->assertStringEndsWith( ',"",""', $lines[2] );
	}

	private function first_target( $url ) {
		$items = Red_Item::get_for_matched_url( $url );

		return count( $items ) > 0 ? $items[0]->get_action_data() : null;
	}

	public function testAFallbackSavedAfterwardsServesWheneverTheCampaignIsNotLive() {
		// The drawer's "When it isn't live" field saves a second, unscheduled redirect after the scheduled one.
		$campaign = $this->create( '/bfcm', [ 'action_data' => [ 'url' => '/black-friday' ], 'start_at' => $this->utc( -HOUR_IN_SECONDS ), 'end_at' => $this->utc( HOUR_IN_SECONDS ) ] );
		$this->create( '/bfcm', [ 'action_data' => [ 'url' => '/deals' ] ] );

		$this->assertSame( '/black-friday', $this->first_target( '/bfcm' ) );

		$campaign->update( [ 'url' => '/bfcm', 'group_id' => $this->group->get_id(), 'match_type' => 'url', 'action_type' => 'url', 'action_code' => 301, 'action_data' => [ 'url' => '/black-friday' ], 'start_at' => $this->utc( -2 * HOUR_IN_SECONDS ), 'end_at' => $this->utc( -HOUR_IN_SECONDS ) ] );

		$this->assertSame( '/deals', $this->first_target( '/bfcm' ) );
	}
}
