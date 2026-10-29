<?php

class ErrorTest extends WP_UnitTestCase {
	private function set_404( $is_404 ) {
		global $wp_query;

		wp_reset_query();
		set_query_var( 'is_404', $is_404 );

		$wp_query->is_404 = $is_404;
	}

	public function setUp(): void {
		// Without this WordPress skips its per-test hook backup and DB transaction, and the error action's
		// pre_handle_404 and wp hooks outlive the test, turning later tests' requests into 404s.
		parent::setUp();

		$module = Redirection::init()->get_module();
		$module->reset();
	}

	public function testErrorAction() {
		global $wp_query;

		$wp_query->posts = array( 1 );
		$this->set_404( false );

		$action = Red_Action::create( 'error', 1 );
		$action->run( 410, 'test' );

		$this->assertTrue( get_query_var( 'is_404' ) );
		// Falls back to the index template when the theme has no 404 template, rather than returning an empty string.
		$expected_template = get_404_template();
		$expected_template = $expected_template !== '' ? $expected_template : get_index_template();
		$this->assertEquals( $expected_template, $action->template_include() );
		$this->assertFalse( $action->pre_handle_404() );
		$this->assertEquals( [], $wp_query->posts );
	}
}
