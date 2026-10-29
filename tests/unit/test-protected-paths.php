<?php

use Redirection\Core\Regex;
use Redirection\Url\ProtectedPaths;
use Redirection\Url\Wildcard;

require_once PLUGIN_PATH . '/includes/core/class-regex.php';
require_once PLUGIN_PATH . '/includes/url/class-wildcard.php';
require_once PLUGIN_PATH . '/includes/url/class-protected-paths.php';

class ProtectedPathsTest extends TestCase {
	private function plain( $source ) {
		return ProtectedPaths::find_blocked( $source, null, ProtectedPaths::DEFAULTS );
	}

	private function wildcard( $source ) {
		return ProtectedPaths::find_blocked( $source, new Regex( Wildcard::to_pattern( $source ), true ), ProtectedPaths::DEFAULTS );
	}

	private function regex( $source ) {
		return ProtectedPaths::find_blocked( $source, new Regex( $source, true ), ProtectedPaths::DEFAULTS );
	}

	public function testPlainSourcesUnderAProtectedPathAreBlocked() {
		$this->assertSame( '/wp-admin', $this->plain( '/wp-admin' ) );
		$this->assertSame( '/wp-admin', $this->plain( '/wp-admin/edit.php' ) );
		$this->assertSame( '/wp-login.php', $this->plain( '/WP-LOGIN.PHP?action=lostpassword' ) );
		$this->assertSame( '/wp-json', $this->plain( '/wp-json/wp/v2/posts/' ) );
	}

	public function testPlainSourcesThatOnlyShareAPrefixAreAllowed() {
		$this->assertNull( $this->plain( '/wp-admin-guide' ) );
		$this->assertNull( $this->plain( '/winter-sale' ) );
		$this->assertNull( $this->plain( '/' ) );
	}

	public function testWildcardsThatWouldCatchAProtectedPathAreBlocked() {
		$this->assertSame( '/wp-admin', $this->wildcard( '/wp-*' ) );
		$this->assertSame( '/wp-json', $this->wildcard( '/wp-json*' ) );
		$this->assertNull( $this->wildcard( '/blog/*' ) );
	}

	public function testRegexesThatWouldCatchAProtectedPathAreBlocked() {
		$this->assertSame( '/wp-admin', $this->regex( '^/(.*)$' ) );
		$this->assertSame( '/robots.txt', $this->regex( '^/robots\.txt$' ) );
		$this->assertNull( $this->regex( '^/blog/(\d+)$' ) );
	}

	public function testRegexesAimedDeeperInsideAProtectedPathAreBlocked() {
		$this->assertSame( '/wp-admin', $this->regex( '^/wp-admin/admin-ajax\.php$' ) );
		$this->assertSame( '/wp-json', $this->regex( '^/wp-json/wp/v2/.*' ) );
		$this->assertSame( '/wp-login.php', $this->regex( '/wp-login\.php\?action=logout' ) );
	}

	public function testSiteSpecificPathsAreChecked() {
		$this->assertSame( '/cart', ProtectedPaths::find_blocked( '/cart/', null, [ '/cart/' ] ) );
		$this->assertNull( ProtectedPaths::find_blocked( '/cartoons', null, [ '/cart' ] ) );
	}
}
