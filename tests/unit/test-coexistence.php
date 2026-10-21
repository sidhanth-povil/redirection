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

	/**
	 * PHP binds top-level functions at compile time, so the guard's `return` cannot stop a redeclare.
	 * Runs in a separate process because the original's declarations would leak into this one.
	 */
	public function testMainFileLoadsAfterOriginalDeclaredItsFunctions() {
		$script = '<?php
			function get_option() { return [ "redirection/redirection.php" ]; }
			function is_multisite() { return false; }
			function add_action() {}
			function redirection_autoload_namespace() {}
			require ' . var_export( PLUGIN_PATH . '/dsuite-redirects.php', true ) . ';
			echo "dormant";';
		$file = tempnam( sys_get_temp_dir(), 'dsr' );
		file_put_contents( $file, $script );

		$output = shell_exec( escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( $file ) . ' 2>&1' );
		unlink( $file );

		$this->assertSame( 'dormant', trim( (string) $output ) );
	}
}
