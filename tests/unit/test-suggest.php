<?php

use Redirection\Log\Suggest;

require_once PLUGIN_PATH . '/includes/log/class-suggest.php';

class SuggestTest extends TestCase {
	private function post( $id, $name ) {
		return (object) [ 'ID' => $id, 'post_name' => $name ];
	}

	public function testCandidatesTrimTheLastSlugOneWordAtATime() {
		$this->assertSame( [ 'summer-sale-2025', 'summer-sale', 'summer' ], Suggest::slug_candidates( '/blog/summer-sale-2025/' ) );
	}

	public function testCandidatesIgnoreQueryExtensionAndCase() {
		$this->assertSame( [ 'old-page', 'old' ], Suggest::slug_candidates( '/Old-Page.html?utm_source=x' ) );
	}

	public function testCandidatesSkipShortAndNumberOnlySlugs() {
		$this->assertSame( [], Suggest::slug_candidates( '/' ) );
		$this->assertSame( [], Suggest::slug_candidates( '/2025/10/' ) );
		$this->assertSame( [ 'news-1', 'news' ], Suggest::slug_candidates( '/news-1' ) );
		$this->assertSame( [ 'ab-cd' ], Suggest::slug_candidates( '/ab-cd' ) );
	}

	public function testPickPrefersTheLongestExactSlug() {
		$candidates = [ 'summer-sale-2025', 'summer-sale', 'summer' ];
		$posts = [ $this->post( 1, 'summer' ), $this->post( 2, 'summer-sale' ) ];

		$this->assertSame( 2, Suggest::pick( $candidates, $posts ) );
	}

	public function testPickFallsBackToTheShortestLongerSlug() {
		$candidates = [ 'summer-sale', 'summer' ];
		$posts = [ $this->post( 3, 'summer-sale-2026-final' ), $this->post( 4, 'summer-sale-2026' ) ];

		$this->assertSame( 4, Suggest::pick( $candidates, $posts ) );
	}

	public function testPickReturnsZeroWithoutAMatch() {
		$this->assertSame( 0, Suggest::pick( [ 'gone' ], [ $this->post( 5, 'something-else' ) ] ) );
		$this->assertSame( 0, Suggest::pick( [], [] ) );
	}
}
