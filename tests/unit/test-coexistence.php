<?php

require_once PLUGIN_PATH . '/includes/core/coexistence.php';

class CoexistenceTest extends TestCase {
	public function testInactiveWhenNothingActive() {
		$this->assertFalse( dsr_original_redirection_active( [], [] ) );
	}

	public function testIgnoresOurOwnPlugin() {
		$this->assertFalse( dsr_original_redirection_active( [ 'dsuite-redirects/dsuite-redirects.php' ], [] ) );
	}

	public function testDetectsSiteActivatedOriginal() {
		$active = [ 'akismet/akismet.php', 'redirection/redirection.php' ];

		$this->assertTrue( dsr_original_redirection_active( $active, [] ) );
	}

	public function testDetectsNetworkActivatedOriginal() {
		$network = [ 'redirection/redirection.php' => 1700000000 ];

		$this->assertTrue( dsr_original_redirection_active( [], $network ) );
	}

	public function testIgnoresSimilarlyNamedPlugins() {
		$active = [ 'seo-redirection/seo-redirection.php', 'redirection-pro/redirection.php' ];

		$this->assertFalse( dsr_original_redirection_active( $active, [] ) );
	}
}
