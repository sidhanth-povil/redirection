<?php

class OriginalUninstallTest extends WP_UnitTestCase {
	public function testForgetsOriginalUninstallHookSoDeletingItKeepsSharedTables() {
		update_option(
			'uninstall_plugins',
			[
				'redirection/redirection.php' => [ 'Redirection\Plugin\Admin', 'plugin_uninstall' ],
				'other/other.php' => 'other_uninstall',
			]
		);

		dsr_forget_original_uninstall();

		$this->assertSame( [ 'other/other.php' => 'other_uninstall' ], get_option( 'uninstall_plugins' ) );
	}

	public function testLeavesOptionAloneWhenOriginalNotRegistered() {
		update_option( 'uninstall_plugins', [ 'other/other.php' => 'other_uninstall' ] );

		dsr_forget_original_uninstall();

		$this->assertSame( [ 'other/other.php' => 'other_uninstall' ], get_option( 'uninstall_plugins' ) );
	}
}
