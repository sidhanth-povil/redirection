<?php

class SlugWatcherTest extends WP_UnitTestCase {
	private $group;

	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );

		$this->set_permalink_structure( '/%postname%/' );
		$this->group = Red_Group::create( 'slugs', 1 );
	}

	private function redirect_to( $url, $target ) {
		return Red_Item::create(
			[
				'url' => $url,
				'group_id' => $this->group->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_code' => 302,
				'action_data' => [ 'url' => $target ],
			]
		);
	}

	private function target( $item ) {
		return Red_Item::get_by_id( $item->get_id() )->get_action_data();
	}

	public function testRedirectsFollowAPageWhoseSlugChanges() {
		$post = self::factory()->post->create( [ 'post_name' => 'summer-landing', 'post_status' => 'publish' ] );
		$absolute = $this->redirect_to( '/a', get_permalink( $post ) );
		$relative = $this->redirect_to( '/b', '/summer-landing/' );
		$no_slash = $this->redirect_to( '/c', '/summer-landing' );
		$other = $this->redirect_to( '/d', '/summer-landing-old/' );

		wp_update_post( [ 'ID' => $post, 'post_name' => 'summer-2026' ] );

		$this->assertSame( home_url( '/summer-2026/' ), $this->target( $absolute ) );
		$this->assertSame( '/summer-2026/', $this->target( $relative ) );
		$this->assertSame( '/summer-2026', $this->target( $no_slash ) );
		$this->assertSame( '/summer-landing-old/', $this->target( $other ) );
	}

	public function testDraftsAreLeftAlone() {
		// A draft has no public address yet, so nothing can point at it.
		$post = self::factory()->post->create( [ 'post_name' => 'draft-page', 'post_status' => 'draft' ] );
		$item = $this->redirect_to( '/a', '/draft-page/' );

		wp_update_post( [ 'ID' => $post, 'post_name' => 'renamed' ] );

		$this->assertSame( '/draft-page/', $this->target( $item ) );
	}

	public function testUnchangedSlugsTouchNothing() {
		$post = self::factory()->post->create( [ 'post_name' => 'stays', 'post_status' => 'publish' ] );
		$item = $this->redirect_to( '/a', '/stays/' );
		$updated = 0;
		$count = function () use ( &$updated ) {
			$updated++;
		};
		add_action( 'redirection_redirect_updated', $count );

		wp_update_post( [ 'ID' => $post, 'post_title' => 'New title' ] );
		remove_action( 'redirection_redirect_updated', $count );

		$this->assertSame( '/stays/', $this->target( $item ) );
		$this->assertSame( 0, $updated );
	}

	public function testTargetsThatOnlyMatchIgnoringCaseAreLeftAlone() {
		// MySQL compares case-insensitively; the rewrite must still only touch exact matches.
		$post = self::factory()->post->create( [ 'post_name' => 'summer-landing', 'post_status' => 'publish' ] );
		$item = $this->redirect_to( '/a', '/Summer-Landing/' );

		wp_update_post( [ 'ID' => $post, 'post_name' => 'summer-2026' ] );

		$this->assertSame( '/Summer-Landing/', $this->target( $item ) );
	}

	public function testNeverMakesARedirectPointAtItself() {
		// /a -> /b, then the page at /b is renamed back to /a: rewriting would make /a -> /a.
		$post = self::factory()->post->create( [ 'post_name' => 'b', 'post_status' => 'publish' ] );
		$item = $this->redirect_to( '/a/', '/b/' );

		wp_update_post( [ 'ID' => $post, 'post_name' => 'a' ] );

		$this->assertSame( '/b/', $this->target( $item ) );
	}
}
