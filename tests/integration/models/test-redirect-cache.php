<?php

class RedirectCacheTest extends WP_UnitTestCase {
	private function get_cache( $onoff = true ) {
		red_set_options( [ 'cache_key' => $onoff ? 1 : 0 ] );
		$cache = Redirect_Cache::init();
		$cache->reset();
		return $cache;
	}

	public function testMatchedEntriesExpire() {
		global $wp_object_cache;

		$original = $wp_object_cache;
		$cache = $this->get_cache();
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$wp_object_cache = new class() extends WP_Object_Cache {
			public $expires = [];

			public function set( $key, $data, $group = 'default', $expire = 0 ) {
				$this->expires[ $group ][] = $expire;
				return parent::set( $key, $data, $group, $expire );
			}
		};

		// Each visitor URL is its own key, so an entry that never expires lets visitors fill a persistent cache
		$item = new Red_Item( [ 'match_type' => 'url' ] );
		$cache->set( '/cat?utm=1', $item, [ $item ] );
		$expires = $wp_object_cache->expires['redirection'];
		// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$wp_object_cache = $original;

		$this->assertGreaterThan( 0, $expires[0] );
	}

	public function testCanCache() {
		$cache = $this->get_cache();

		$this->assertTrue( $cache->can_cache() );
	}

	public function testCannotCache() {
		$cache = $this->get_cache( false );

		$this->assertFalse( $cache->can_cache() );
	}

	public function testNoCache() {
		$cache = $this->get_cache();

		$this->assertTrue( $cache->can_cache() );
	}

	public function testEmptyCache() {
		$cache = $this->get_cache();

		$this->assertFalse( $cache->get( '/cat' ) );
	}

	public function testSetCache() {
		red_set_options( [ 'cache_key' => 1 ] );

		$item = new Red_Item( [ 'match_type' => 'url' ] );

		$cache = $this->get_cache();

		$this->assertTrue( $cache->set( '/cat', $item, [ $item ] ) );
		$this->assertEquals( [ $item->to_sql() ], $cache->get( '/cat' ) );
	}

	public function testCannotDoubleSetCache() {
		red_set_options( [ 'cache_key' => 1 ] );

		$item = new Red_Item( [ 'match_type' => 'url' ] );

		$cache = $this->get_cache();

		$this->assertTrue( $cache->set( '/cat', $item, [ $item ] ) );
		$cache->get( '/cat' );
		$this->assertFalse( $cache->set( '/cat', $item, [ $item ] ) );
	}

	public function testDynamicMatch() {
		$item1 = new Red_Item( [ 'match_type' => 'agent' ] );
		$item2 = new Red_Item( [ 'match_type' => 'agent' ] );

		$cache = $this->get_cache();
		$cache->set( '/cat', $item2, [ $item1, $item2 ] );

		$this->assertEquals( [ $item1->to_sql(), $item2->to_sql() ], $cache->get( '/cat' ) );
	}

	public function testStaticMatchWithDynamic() {
		$item1 = new Red_Item( [ 'match_type' => 'agent' ] );
		$item2 = new Red_Item( [ 'match_type' => 'url' ] );

		$cache = $this->get_cache();
		$cache->set( '/cat', $item2, [ $item1, $item2 ] );

		$this->assertEquals( [ $item1->to_sql(), $item2->to_sql() ], $cache->get( '/cat' ) );
	}

	// Check that when a redirect is updated and the cache key is changed then the previous cache entry is ignored
	public function testCacheReset() {
		$item = new Red_Item( [ 'match_type' => 'url' ] );

		$cache = $this->get_cache();
		$cache->set( '/cat', $item, [ $item ] );
		$this->assertEquals( [ $item->to_sql() ], $cache->get( '/cat' ) );

		red_set_options( [ 'cache_key' => 2 ] );
		$cache->reset();

		$this->assertFalse( $cache->get( '/cat' ) );
	}
}
