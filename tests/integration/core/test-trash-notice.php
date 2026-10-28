<?php

use Redirection\Plugin\TrashNotice;

class TrashNoticeTest extends WP_UnitTestCase {
	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );
		$this->set_permalink_structure( '/%postname%/' );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		set_current_screen( 'edit' );
	}

	public function tearDown(): void {
		unset( $_GET['trashed'], $_GET['ids'] );
		parent::tearDown();
	}

	private function trash( array $args ) {
		$id = self::factory()->post->create( $args );
		wp_trash_post( $id );

		$_GET['trashed'] = '1';
		$_GET['ids'] = (string) $id;

		return $id;
	}

	private function notice() {
		ob_start();
		TrashNotice::show();

		return (string) ob_get_clean();
	}

	public function testOffersARedirectForATrashedPublishedPost() {
		$this->trash( [ 'post_name' => 'spring-offer', 'post_status' => 'publish' ] );

		$notice = $this->notice();

		$this->assertStringContainsString( '/spring-offer/', $notice );
		$this->assertStringContainsString( '#/redirects?new=1&#038;from=%2Fspring-offer%2F', $notice );
	}

	public function testSaysNothingForATrashedDraft() {
		$this->trash( [ 'post_name' => 'never-live', 'post_status' => 'draft' ] );

		$this->assertSame( '', $this->notice() );
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
		$this->trash( [ 'post_name' => 'handled', 'post_status' => 'publish' ] );

		$this->assertSame( '', $this->notice() );
	}

	public function testSaysNothingToUsersWhoCannotAddRedirects() {
		$this->trash( [ 'post_name' => 'spring-offer', 'post_status' => 'publish' ] );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );

		$this->assertSame( '', $this->notice() );
	}

	public function testSaysNothingOutsideThePostList() {
		$this->trash( [ 'post_name' => 'spring-offer', 'post_status' => 'publish' ] );
		set_current_screen( 'dashboard' );

		$this->assertSame( '', $this->notice() );
	}
}
