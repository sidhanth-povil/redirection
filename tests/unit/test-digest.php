<?php

use Redirection\Alerts\Digest;

require_once PLUGIN_PATH . '/includes/alerts/class-digest.php';

class DigestTest extends TestCase {
	private function row( $url, $hits ) {
		return [ 'url' => $url, 'hits' => $hits, 'referrer' => '' ];
	}

	private function never_redirected() {
		return function () {
			return false;
		};
	}

	public function testKeepsOnlyUrlsWithEnoughHits() {
		$rows = [ $this->row( '/a', 5 ), $this->row( '/b', 2 ), $this->row( '/c', 3 ) ];

		$this->assertSame( [ '/a', '/c' ], array_column( Digest::select( $rows, 3, $this->never_redirected() ), 'url' ) );
	}

	public function testLeavesOutUrlsARedirectNowHandles() {
		$rows = [ $this->row( '/fixed', 9 ), $this->row( '/broken', 4 ) ];
		$redirected = function ( $url ) {
			return $url === '/fixed';
		};

		$this->assertSame( [ '/broken' ], array_column( Digest::select( $rows, 1, $redirected ), 'url' ) );
	}

	public function testTakesTheTop20ByHits() {
		$rows = [];
		for ( $i = 1; $i <= 25; $i++ ) {
			$rows[] = $this->row( '/p' . $i, $i );
		}

		$selected = Digest::select( $rows, 1, $this->never_redirected() );

		$this->assertCount( 20, $selected );
		$this->assertSame( '/p25', $selected[0]['url'] );
		$this->assertSame( '/p6', $selected[19]['url'] );
	}

	public function testNothingInNothingOut() {
		$this->assertSame( [], Digest::select( [], 1, $this->never_redirected() ) );
	}
}
