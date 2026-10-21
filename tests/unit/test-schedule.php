<?php

use Redirection\Redirect\Schedule;

require_once PLUGIN_PATH . '/includes/redirect/class-schedule.php';

class ScheduleTest extends TestCase {
	private function site() {
		return new DateTimeZone( 'Asia/Kolkata' ); // UTC+05:30, no DST
	}

	public function testParsesIsoWithOffsetToUtc() {
		$this->assertSame( '2026-11-27 18:30:00', Schedule::parse( '2026-11-28T00:00:00+05:30', $this->site() ) );
		$this->assertSame( '2026-11-28 00:00:00', Schedule::parse( '2026-11-28T00:00:00Z', $this->site() ) );
	}

	public function testReadsOffsetLessInputInTheSiteTimezone() {
		$this->assertSame( '2026-11-27 18:30:00', Schedule::parse( '2026-11-28T00:00', $this->site() ) );
		$this->assertSame( '2026-11-27 18:30:00', Schedule::parse( '2026-11-28 00:00:00', $this->site() ) );
	}

	public function testEmptyIsUnboundedAndGarbageIsRejected() {
		$this->assertNull( Schedule::parse( '', $this->site() ) );
		$this->assertNull( Schedule::parse( null, $this->site() ) );
		$this->assertFalse( Schedule::parse( 'next blue moon', $this->site() ) );
		$this->assertFalse( Schedule::parse( [ 'x' ], $this->site() ) );
	}

	public function testEndMustBeLaterThanStart() {
		$this->assertTrue( Schedule::is_valid_window( null, null ) );
		$this->assertTrue( Schedule::is_valid_window( '2026-01-01 00:00:00', null ) );
		$this->assertTrue( Schedule::is_valid_window( '2026-01-01 00:00:00', '2026-01-01 00:00:01' ) );
		$this->assertFalse( Schedule::is_valid_window( '2026-01-01 00:00:00', '2026-01-01 00:00:00' ) );
		$this->assertFalse( Schedule::is_valid_window( '2026-01-02 00:00:00', '2026-01-01 00:00:00' ) );
	}

	public function testActiveWindowIsStartInclusiveEndExclusive() {
		$start = '2026-11-28 00:00:00';
		$end = '2026-12-02 00:00:00';

		$this->assertFalse( Schedule::is_active( $start, $end, '2026-11-27 23:59:59' ) );
		$this->assertTrue( Schedule::is_active( $start, $end, '2026-11-28 00:00:00' ) );
		$this->assertTrue( Schedule::is_active( $start, $end, '2026-12-01 23:59:59' ) );
		$this->assertFalse( Schedule::is_active( $start, $end, '2026-12-02 00:00:00' ) );
		$this->assertTrue( Schedule::is_active( null, null, '2026-12-02 00:00:00' ) );
		$this->assertTrue( Schedule::is_active( null, $end, '2020-01-01 00:00:00' ) );
		$this->assertTrue( Schedule::is_active( $start, null, '2030-01-01 00:00:00' ) );
	}

	public function testState() {
		$now = '2026-11-30 12:00:00';

		$this->assertSame( 'none', Schedule::state( null, null, $now ) );
		$this->assertSame( 'scheduled', Schedule::state( '2026-12-01 00:00:00', null, $now ) );
		$this->assertSame( 'live', Schedule::state( '2026-11-28 00:00:00', '2026-12-02 00:00:00', $now ) );
		$this->assertSame( 'live', Schedule::state( null, '2026-12-02 00:00:00', $now ) );
		$this->assertSame( 'expired', Schedule::state( null, '2026-11-30 12:00:00', $now ) );
	}

	public function testSiteIsoRoundTrips() {
		$iso = Schedule::to_site_iso( '2026-11-27 18:30:00', $this->site() );

		$this->assertSame( '2026-11-28T00:00:00+05:30', $iso );
		$this->assertSame( '2026-11-27 18:30:00', Schedule::parse( $iso, $this->site() ) );
		$this->assertNull( Schedule::to_site_iso( null, $this->site() ) );
	}
}
