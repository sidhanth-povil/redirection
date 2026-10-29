<?php

use Redirection\Plugin\AdminBar;

class AdminBarTest extends WP_UnitTestCase {
	public function setUp(): void {
		parent::setUp();

		$this->set_permalink_structure( '/%postname%/' );
		require_once ABSPATH . WPINC . '/class-wp-admin-bar.php';
	}

	// $query resolves the request without rewrite rules, which earlier tests can leave stale; $path is what the visitor sees.
	private function node( $query, $path ) {
		$this->go_to( home_url( $query ) );
		$_SERVER['REQUEST_URI'] = $path . '?utm_source=preview';

		$bar = new WP_Admin_Bar();
		AdminBar::add_node( $bar );

		return $bar->get_node( AdminBar::NODE_ID );
	}

	public function testOffersARedirectToTheCurrentPage() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$post = self::factory()->post->create( [ 'post_name' => 'summer-landing', 'post_status' => 'publish' ] );

		$node = $this->node( '/?p=' . $post, '/summer-landing/' );

		$this->assertNotNull( $node );
		$this->assertStringEndsWith( '#/redirects?new=1&to=%2Fsummer-landing%2F', $node->href );
	}

	public function testOffersToFixA404() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$node = $this->node( '/?p=999999', '/no-such-page/' );

		$this->assertNotNull( $node );
		$this->assertStringEndsWith( '#/redirects?new=1&from=%2Fno-such-page%2F', $node->href );
	}

	public function testHiddenFromUsersWhoCannotAddRedirects() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$post = self::factory()->post->create( [ 'post_status' => 'publish' ] );

		$this->assertNull( $this->node( '/?p=' . $post, '/hello/' ) );
	}
}
