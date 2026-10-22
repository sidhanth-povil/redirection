<?php

use Redirection\Alerts\Digest;
use Redirection\Settings\Settings;

class DigestJobTest extends WP_UnitTestCase {
	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_404" );
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );
		delete_option( Digest::LAST_SENT_OPTION );
		reset_phpmailer_instance();
		// The test site's host is localhost, which makes WordPress's default From address invalid.
		add_filter( 'wp_mail_from', [ $this, 'from_address' ] );
		Settings::save( [ 'dsr_alerts' => [ 'enabled' => true, 'min_hits' => 1, 'recipients' => 'team@example.com' ] ] );
	}

	public function from_address() {
		return 'wordpress@example.com';
	}

	public function tearDown(): void {
		Settings::save( [ 'dsr_alerts' => [ 'enabled' => false ] ] );
		parent::tearDown();
	}

	private function log404( $url, $times = 1 ) {
		for ( $i = 0; $i < $times; $i++ ) {
			Red_404_Log::create( 'domain', $url, '1.1.1.1', [ 'referrer' => 'https://ref.test/' ] );
		}
	}

	private function sent() {
		return tests_retrieve_phpmailer_instance()->get_sent();
	}

	// PHPMailer quoted-printable encodes long HTML lines.
	private function body() {
		return quoted_printable_decode( $this->sent()->body );
	}

	public function testEmailsTheNewUrlsAsHtmlWithCreateRedirectLinks() {
		$this->log404( '/a&b', 2 );
		$this->log404( '/c' );

		$this->assertTrue( Digest::run() );

		$mail = $this->sent();
		$this->assertSame( 'team@example.com', $mail->to[0][0] );
		$this->assertStringContainsString( '2 new 404s this week', $mail->subject );
		$this->assertStringContainsString( '/a&amp;b', $this->body() );
		$this->assertStringContainsString( 'from=%2Fa%26b', $this->body() );
		$this->assertStringContainsString( 'https://ref.test/', $this->body() );
		$this->assertStringContainsString( 'Content-Type: text/html', $mail->header );
		$this->assertGreaterThan( 0, get_option( Digest::LAST_SENT_OPTION ) );
	}

	public function testNothingNewSendsNoEmailButMovesTheWindowOn() {
		$this->assertFalse( Digest::run() );

		$this->assertFalse( $this->sent() );
		$this->assertGreaterThan( 0, get_option( Digest::LAST_SENT_OPTION ) );
	}

	public function testAFailedSendIsRetriedNextTime() {
		$this->log404( '/a' );
		add_filter( 'pre_wp_mail', '__return_false' );

		$this->assertFalse( Digest::run() );
		$this->assertFalse( get_option( Digest::LAST_SENT_OPTION ) );

		remove_filter( 'pre_wp_mail', '__return_false' );
	}

	public function testOnlyIncludes404sSinceTheLastEmail() {
		global $wpdb;

		$this->log404( '/old' );
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}redirection_404 SET created = %s", wp_date( 'Y-m-d H:i:s', time() - 2 * DAY_IN_SECONDS ) ) );
		$this->log404( '/new' );
		update_option( Digest::LAST_SENT_OPTION, time() - DAY_IN_SECONDS );

		Digest::run();

		$this->assertStringContainsString( '/new', $this->body() );
		$this->assertStringNotContainsString( '/old', $this->body() );
	}

	public function testSettingsAreSanitised() {
		$alerts = Settings::save(
			[ 'dsr_alerts' => [ 'enabled' => '1', 'frequency' => 'hourly', 'recipients' => 'nope, ok@example.com', 'min_hits' => 0 ] ]
		)['dsr_alerts'];

		$this->assertSame(
			[ 'enabled' => true, 'frequency' => 'weekly', 'recipients' => [ 'ok@example.com' ], 'min_hits' => 1 ],
			$alerts
		);
	}

	public function testSavingSchedulesReschedulesAndClearsTheJob() {
		$this->assertSame( 'weekly', wp_get_schedule( Digest::HOOK ) );

		Settings::save( [ 'dsr_alerts' => [ 'enabled' => true, 'frequency' => 'daily' ] ] );
		$this->assertSame( 'daily', wp_get_schedule( Digest::HOOK ) );

		Settings::save( [ 'dsr_alerts' => [ 'enabled' => false ] ] );
		$this->assertFalse( wp_get_schedule( Digest::HOOK ) );
	}

	public function testALongPauseOnlyCoversTheLastPeriod() {
		global $wpdb;

		$this->log404( '/months-ago' );
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}redirection_404 SET created = %s", wp_date( 'Y-m-d H:i:s', time() - 60 * DAY_IN_SECONDS ) ) );
		$this->log404( '/this-week' );
		update_option( Digest::LAST_SENT_OPTION, time() - 90 * DAY_IN_SECONDS );

		Digest::run();

		$this->assertStringContainsString( '/this-week', $this->body() );
		$this->assertStringNotContainsString( '/months-ago', $this->body() );
	}
}
