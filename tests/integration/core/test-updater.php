<?php

use Redirection\Plugin\Updater;

class UpdaterTest extends WP_UnitTestCase {
	const ZIP = 'https://github.com/sidhanth-povil/redirection/releases/download/v9.9.9/dsuite-redirects.zip';

	private $requests = 0;

	// Location GitHub sends /releases/latest to, or a status code for an error
	private $latest;

	private $zip_status;

	public function setUp(): void {
		parent::setUp();

		delete_site_transient( Updater::CACHE_KEY );
		$this->requests = 0;
		$this->latest = 'https://github.com/sidhanth-povil/redirection/releases/tag/v9.9.9';
		$this->zip_status = 302;
		add_filter( 'pre_http_request', [ $this, 'fake_github' ], 10, 3 );
	}

	public function tearDown(): void {
		remove_filter( 'pre_http_request', [ $this, 'fake_github' ], 10 );
		parent::tearDown();
	}

	public function fake_github( $result, $args, $url ) {
		if ( strpos( $url, 'https://github.com/' ) !== 0 && strpos( $url, 'https://api.github.com/' ) !== 0 ) {
			return $result;
		}

		$this->requests++;

		// No API: it allows 60 requests an hour per address, which shared hosting runs out of
		$this->assertStringStartsNotWith( 'https://api.github.com/', $url );
		$this->assertSame( 0, $args['redirection'] );

		if ( $url === Updater::LATEST_URL ) {
			return is_int( $this->latest ) ? $this->response( $this->latest ) : $this->response( 302, $this->latest );
		}

		return $url === self::ZIP ? $this->response( $this->zip_status, 'https://release-assets.githubusercontent.com/zip' ) : $this->response( 404 );
	}

	private function response( $code, $location = '' ) {
		return [
			'headers' => $location === '' ? [] : [ 'location' => $location ],
			'body' => '',
			'response' => [
				'code' => $code,
				'message' => '',
			],
			'cookies' => [],
			'filename' => null,
		];
	}

	private function check( $file = null ) {
		return apply_filters( 'update_plugins_github.com', false, [ 'Version' => REDIRECTION_VERSION ], $file ?? plugin_basename( REDIRECTION_FILE ), [] );
	}

	private function row_meta() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		return implode( ' ', apply_filters( 'plugin_row_meta', [], plugin_basename( REDIRECTION_FILE ), [], 'all' ) );
	}

	public function testOffersTheLatestGitHubRelease() {
		$update = $this->check();

		$this->assertSame( '9.9.9', $update['version'] );
		$this->assertSame( self::ZIP, $update['package'] );
		$this->assertSame( plugin_basename( REDIRECTION_FILE ), $update['plugin'] );
		$this->assertSame( 'dsuite-redirects', $update['slug'] );
	}

	public function testLeavesOtherPluginsAlone() {
		$this->assertFalse( $this->check( 'other-plugin/other-plugin.php' ) );
		$this->assertSame( 0, $this->requests );
	}

	public function testOnlyFollowsThisRepositorysReleases() {
		// A redirect must never point WordPress at a package hosted anywhere else
		$this->latest = 'https://github.com/someone-else/redirection/releases/tag/v9.9.9';

		$this->assertFalse( $this->check() );
	}

	public function testNeedsTheZipInTheRelease() {
		$this->zip_status = 404;

		$this->assertFalse( $this->check() );
		$this->assertStringContainsString( 'dsuite-redirects.zip', $this->row_meta() );
	}

	public function testIgnoresATagThatIsNotAVersion() {
		$this->latest = 'https://github.com/sidhanth-povil/redirection/releases/tag/nightly';

		$this->assertFalse( $this->check() );
	}

	public function testGitHubErrorsGiveNoUpdateAndSayWhy() {
		$this->latest = 429;

		$this->assertFalse( $this->check() );
		$this->assertStringContainsString( 'Update check failed', $this->row_meta() );
		$this->assertStringContainsString( '429', $this->row_meta() );
	}

	public function testSaysNothingOnThePluginsRowWhenTheCheckWorks() {
		$this->check();

		$this->assertStringNotContainsString( 'Update check failed', $this->row_meta() );
	}

	public function testAsksGitHubOnceUntilTheCacheExpires() {
		$this->check();
		$this->check();

		// One request for the latest tag, one to confirm its zip
		$this->assertSame( 2, $this->requests );
	}

	public function testAFailedCheckIsCachedToo() {
		$this->latest = 500;
		$this->check();
		$this->check();

		$this->assertSame( 1, $this->requests );
	}

	public function testDetailsComeFromGitHubNotWordPressOrg() {
		$info = apply_filters( 'plugins_api', false, 'plugin_information', (object) [ 'slug' => 'dsuite-redirects' ] );

		$this->assertSame( 'DSuite Redirects', $info->name );
		$this->assertSame( '9.9.9', $info->version );
		$this->assertSame( self::ZIP, $info->download_link );
		$this->assertStringContainsString( 'releases/tag/v9.9.9', $info->sections['changelog'] );
	}

	public function testDetailsForOtherPluginsAreLeftToWordPressOrg() {
		$this->assertFalse( apply_filters( 'plugins_api', false, 'plugin_information', (object) [ 'slug' => 'akismet' ] ) );
	}

	public function testClearingWordPressUpdateCacheAsksGitHubAgain() {
		$this->latest = 500;
		$this->check();

		// WordPress clears its own update cache after installing or activating plugins
		delete_site_transient( 'update_plugins' );
		$this->check();

		$this->assertSame( 2, $this->requests );
	}

	public function testCheckAgainOnTheUpdatesPageAsksGitHubAgain() {
		$this->latest = 500;
		$this->check();

		// Dashboard > Updates > Check again only reloads the page with force-check=1; it keeps WordPress's update cache
		$_GET['force-check'] = '1';
		Updater::force_check();
		unset( $_GET['force-check'] );
		$this->check();

		$this->assertSame( 2, $this->requests );
	}

	public function testOpeningTheUpdatesPageKeepsTheCache() {
		$this->latest = 500;
		$this->check();
		Updater::force_check();
		$this->check();

		$this->assertSame( 1, $this->requests );
	}

	public function testCheckAgainClearsTheCacheBeforeWordPressAsksForUpdates() {
		$this->assertSame( 9, has_action( 'load-update-core.php', [ Updater::class, 'force_check' ] ) );
		$this->assertSame( 10, has_action( 'load-update-core.php', 'wp_update_plugins' ) );
	}
}
