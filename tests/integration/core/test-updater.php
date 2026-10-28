<?php

use Redirection\Plugin\Updater;

class UpdaterTest extends WP_UnitTestCase {
	const ZIP = 'https://github.com/sidhanth-povil/redirection/releases/download/v9.9.9/dsuite-redirects.zip';

	private $requests = 0;

	private $response;

	public function setUp(): void {
		parent::setUp();

		delete_site_transient( Updater::CACHE_KEY );
		$this->requests = 0;
		$this->response = $this->release( 'v9.9.9', self::ZIP );
		add_filter( 'pre_http_request', [ $this, 'fake_github' ], 10, 3 );
	}

	public function tearDown(): void {
		remove_filter( 'pre_http_request', [ $this, 'fake_github' ], 10 );
		parent::tearDown();
	}

	public function fake_github( $result, $args, $url ) {
		if ( $url !== Updater::RELEASE_API ) {
			return $result;
		}

		$this->requests++;
		return $this->response;
	}

	private function release( $tag, $asset_url, $code = 200 ) {
		return [
			'headers' => [],
			'body' => wp_json_encode(
				[
					'tag_name' => $tag,
					'html_url' => 'https://github.com/sidhanth-povil/redirection/releases/tag/' . $tag,
					'assets' => [
						[
							'name' => 'dsuite-redirects.zip',
							'browser_download_url' => $asset_url,
						],
					],
				]
			),
			'response' => [
				'code' => $code,
				'message' => 'OK',
			],
			'cookies' => [],
			'filename' => null,
		];
	}

	private function check( $file = null ) {
		return apply_filters( 'update_plugins_github.com', false, [ 'Version' => REDIRECTION_VERSION ], $file ?? plugin_basename( REDIRECTION_FILE ), [] );
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

	public function testOnlyAcceptsAZipFromThisRepository() {
		// A release must never point WordPress at a package hosted anywhere else
		$this->response = $this->release( 'v9.9.9', 'https://github.com/someone-else/redirection/releases/download/v9.9.9/dsuite-redirects.zip' );

		$this->assertFalse( $this->check() );
	}

	public function testIgnoresATagThatIsNotAVersion() {
		$this->response = $this->release( 'nightly', self::ZIP );

		$this->assertFalse( $this->check() );
	}

	public function testGitHubErrorsGiveNoUpdate() {
		$this->response = $this->release( 'v9.9.9', self::ZIP, 500 );

		$this->assertFalse( $this->check() );
	}

	public function testAsksGitHubOnceUntilTheCacheExpires() {
		$this->check();
		$this->check();

		// GitHub allows 60 unauthenticated requests an hour per address
		$this->assertSame( 1, $this->requests );
	}

	public function testAFailedCheckIsCachedToo() {
		$this->response = $this->release( 'v9.9.9', self::ZIP, 500 );
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
		$this->check();

		// WordPress clears its own update cache after installing or activating plugins
		delete_site_transient( 'update_plugins' );
		$this->check();

		$this->assertSame( 2, $this->requests );
	}

	public function testCheckAgainOnTheUpdatesPageAsksGitHubAgain() {
		$this->check();

		// Dashboard > Updates > Check again only reloads the page with force-check=1; it keeps WordPress's update cache
		$_GET['force-check'] = '1';
		Updater::force_check();
		unset( $_GET['force-check'] );
		$this->check();

		$this->assertSame( 2, $this->requests );
	}

	public function testOpeningTheUpdatesPageKeepsTheCache() {
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
