<?php

use Redirection\Plugin\TrashNotice;

class TrashNoticeTest extends WP_UnitTestCase {
	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );

		// Post types only get pretty addresses when permalinks are on as they register
		$this->set_permalink_structure( '/%postname%/' );
		register_post_type( 'product', [ 'public' => true, 'rewrite' => [ 'slug' => 'products' ] ] );
		register_post_type( 'internal_note', [ 'public' => false ] );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
	}

	public function tearDown(): void {
		unregister_post_type( 'product' );
		unregister_post_type( 'internal_note' );
		parent::tearDown();
	}

	private function post( array $args ) {
		return self::factory()->post->create( $args + [ 'post_status' => 'publish' ] );
	}

	private function card() {
		ob_start();
		TrashNotice::show();

		return (string) ob_get_clean();
	}

	public function testOffersARedirectForATrashedPost() {
		wp_trash_post( $this->post( [ 'post_name' => 'spring-offer' ] ) );

		$card = $this->card();

		$this->assertStringContainsString( 'class="dsr-toast"', $card );
		$this->assertStringContainsString( '/spring-offer/', $card );
		$this->assertStringContainsString( '#/redirects?new=1&#038;from=%2Fspring-offer%2F', $card );
		$this->assertStringContainsString( 'Not now', $card );
	}

	public function testCoversCustomPostTypes() {
		wp_trash_post( $this->post( [ 'post_type' => 'product', 'post_name' => 'red-shoe' ] ) );

		$this->assertStringContainsString( '/products/red-shoe/', $this->card() );
	}

	public function testCoversPostsDeletedWithoutTheTrash() {
		wp_delete_post( $this->post( [ 'post_type' => 'product', 'post_name' => 'blue-shoe' ] ), true );

		$this->assertStringContainsString( '/products/blue-shoe/', $this->card() );
	}

	public function testListsSeveralRemovedPostsTogether() {
		wp_trash_post( $this->post( [ 'post_name' => 'first' ] ) );
		wp_trash_post( $this->post( [ 'post_name' => 'second' ] ) );

		$card = $this->card();

		$this->assertStringContainsString( '/first/', $card );
		$this->assertStringContainsString( '/second/', $card );
		$this->assertStringContainsString( 'These addresses now show a 404 page', $card );
	}

	public function testShowsOnlyOnce() {
		wp_trash_post( $this->post( [ 'post_name' => 'spring-offer' ] ) );
		$this->card();

		$this->assertSame( '', $this->card() );
	}

	public function testSaysNothingAfterUndo() {
		$id = $this->post( [ 'post_name' => 'spring-offer' ] );
		wp_trash_post( $id );
		wp_untrash_post( $id );

		$this->assertSame( '', $this->card() );
	}

	public function testSaysNothingForDraftsOrPrivateTypes() {
		wp_trash_post( $this->post( [ 'post_name' => 'never-live', 'post_status' => 'draft' ] ) );
		wp_trash_post( $this->post( [ 'post_type' => 'internal_note', 'post_name' => 'note' ] ) );

		$this->assertSame( '', $this->card() );
	}

	public function testSaysNothingForAPostAlreadyInTheTrash() {
		$id = $this->post( [ 'post_name' => 'spring-offer' ] );
		wp_trash_post( $id );
		$this->card();
		wp_delete_post( $id, true );

		$this->assertSame( '', $this->card() );
	}

	public function testSaysNothingWhenARedirectAlreadyHandlesTheAddress() {
		Red_Item::create(
			[
				'url' => '/handled/',
				'group_id' => Red_Group::create( 'trash', 1 )->get_id(),
				'match_type' => 'url',
				'action_type' => 'url',
				'action_data' => [ 'url' => '/elsewhere/' ],
			]
		);
		wp_trash_post( $this->post( [ 'post_name' => 'handled' ] ) );

		$this->assertSame( '', $this->card() );
	}

	public function testSaysNothingToUsersWhoCannotAddRedirects() {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		wp_trash_post( $this->post( [ 'post_name' => 'spring-offer' ] ) );

		$this->assertSame( '', $this->card() );
	}

	public function testRemovalsAreRememberedPerUser() {
		wp_trash_post( $this->post( [ 'post_name' => 'spring-offer' ] ) );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$this->assertSame( '', $this->card() );
	}

	public function testRemembersWhereverThePostIsRemovedFrom() {
		$this->assertSame( 10, has_action( 'wp_trash_post', [ TrashNotice::class, 'remember' ] ) );
		$this->assertSame( 10, has_action( 'before_delete_post', [ TrashNotice::class, 'remember' ] ) );
		$this->assertSame( 10, has_action( 'untrashed_post', [ TrashNotice::class, 'forget' ] ) );
	}
}
