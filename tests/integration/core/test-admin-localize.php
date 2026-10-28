<?php

use Redirection\Plugin\Admin;

class AdminLocalizeTest extends WP_UnitTestCase {
	private $caps = [];

	public function tearDown(): void {
		remove_filter( Redirection_Capabilities::FILTER_CAPABILITY, [ $this, 'editor_cap' ], 10 );
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function editor_cap( $cap, $name ) {
		return in_array( $name, $this->caps, true ) ? 'editor' : 'manage_options';
	}

	public function testDelegateOnlyGetsSettingsTheirCapabilityAllows() {
		red_set_options( [ 'relocate' => 'https://relocate.example', 'token' => 'private-token' ] );
		wp_set_current_user( $this->factory->user->create( [ 'role' => 'editor' ] ) );
		$this->caps = [ Redirection_Capabilities::CAP_REDIRECT_MANAGE ];
		add_filter( Redirection_Capabilities::FILTER_CAPABILITY, [ $this, 'editor_cap' ], 10, 2 );

		$settings = ( new Admin() )->get_localized_settings();

		$this->assertArrayNotHasKey( 'relocate', $settings );
		$this->assertArrayNotHasKey( 'token', $settings );
		// The redirect form still needs the default source flags
		$this->assertArrayHasKey( 'flag_query', $settings );
	}

	public function testAdministratorGetsAllSettings() {
		red_set_options( [ 'token' => 'private-token' ] );
		wp_set_current_user( $this->factory->user->create( [ 'role' => 'administrator' ] ) );

		$this->assertSame( 'private-token', ( new Admin() )->get_localized_settings()['token'] );
	}
}
