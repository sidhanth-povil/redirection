<?php

use Redirection\Health\Chains;

require_once PLUGIN_PATH . '/includes/health/class-chains.php';

class ChainsTest extends TestCase {
	private function edge( $id, $source, $target, $hits = 0 ) {
		// An external target has no key: it ends a walk.
		$key = strpos( $target, 'https://' ) === 0 ? null : $target;

		return [ 'id' => $id, 'source' => $source, 'target_key' => $key, 'target' => $target, 'hits' => $hits ];
	}

	public function testSingleHopIsNotAChain() {
		$result = ( new Chains( [ $this->edge( 1, '/a', '/b' ) ] ) )->find();

		$this->assertSame( [], $result['chains'] );
		$this->assertSame( [], $result['loops'] );
	}

	public function testSimpleChain() {
		$result = ( new Chains( [ $this->edge( 1, '/a', '/b', 5 ), $this->edge( 2, '/b', '/c' ) ] ) )->find();

		$this->assertCount( 1, $result['chains'] );
		$this->assertSame( 1, $result['chains'][0]['id'] );
		$this->assertSame( [ '/a', '/b', '/c' ], $result['chains'][0]['path'] );
		$this->assertSame( '/c', $result['chains'][0]['final_target'] );
		$this->assertSame( 5, $result['chains'][0]['hits'] );
	}

	public function testEveryMemberOfALongChainIsReportedWithTheSameFinalTarget() {
		$result = ( new Chains(
			[
				$this->edge( 1, '/a', '/b' ),
				$this->edge( 2, '/b', '/c' ),
				$this->edge( 3, '/c', 'https://elsewhere.test/d' ),
			]
		) )->find();

		$this->assertSame( [ 1, 2 ], array_column( $result['chains'], 'id' ) );
		$this->assertSame( [ '/a', '/b', '/c', 'https://elsewhere.test/d' ], $result['chains'][0]['path'] );
		$this->assertSame( [ 'https://elsewhere.test/d', 'https://elsewhere.test/d' ], array_column( $result['chains'], 'final_target' ) );
	}

	public function testLoop() {
		$result = ( new Chains( [ $this->edge( 1, '/a', '/b' ), $this->edge( 2, '/b', '/a' ) ] ) )->find();

		$this->assertSame( [], $result['chains'] );
		$this->assertSame( [ 1, 2 ], array_column( $result['loops'], 'id' ) );
		$this->assertSame( [ '/a', '/b', '/a' ], $result['loops'][0]['path'] );
	}

	public function testSelfLoop() {
		$result = ( new Chains( [ $this->edge( 1, '/a', '/a' ) ] ) )->find();

		$this->assertSame( [ '/a', '/a' ], $result['loops'][0]['path'] );
	}

	public function testLeadingIntoALoopCountsAsALoop() {
		$result = ( new Chains(
			[
				$this->edge( 1, '/in', '/b' ),
				$this->edge( 2, '/b', '/c' ),
				$this->edge( 3, '/c', '/b' ),
			]
		) )->find();

		$this->assertSame( [], $result['chains'] );
		$this->assertSame( [ 1, 2, 3 ], array_column( $result['loops'], 'id' ) );
		$this->assertSame( [ '/in', '/b', '/c', '/b' ], $result['loops'][0]['path'] );
	}

	public function testTheFirstRedirectForASourceWins() {
		$result = ( new Chains(
			[
				$this->edge( 1, '/a', '/b' ),
				$this->edge( 2, '/b', '/c' ),
				$this->edge( 3, '/b', '/a' ),
			]
		) )->find();

		$this->assertSame( [], $result['loops'] );
		$this->assertSame( [ '/a', '/b', '/c' ], $result['chains'][0]['path'] );
	}

	public function testCheckOk() {
		$chains = new Chains( [ $this->edge( 1, '/a', '/b' ) ] );

		$this->assertSame( [ 'status' => 'ok' ], $chains->check( '/x', '/y', '/y' ) );
	}

	public function testCheckChain() {
		$chains = new Chains( [ $this->edge( 1, '/b', '/c' ), $this->edge( 2, '/c', '/d' ) ] );

		$this->assertSame(
			[ 'status' => 'chain', 'path' => [ '/a', '/b', '/c', '/d' ], 'final_target' => '/d' ],
			$chains->check( '/a', '/b', '/b' )
		);
	}

	public function testCheckLoopBackToTheSource() {
		$chains = new Chains( [ $this->edge( 1, '/b', '/a' ) ] );

		$this->assertSame( [ 'status' => 'loop', 'path' => [ '/a', '/b', '/a' ] ], $chains->check( '/a', '/b', '/b' ) );
		$this->assertSame( [ 'status' => 'loop', 'path' => [ '/x', '/x' ] ], $chains->check( '/x', '/x', '/x' ) );
	}

	public function testCheckDuplicate() {
		$chains = new Chains( [ $this->edge( 7, '/a', '/b' ) ] );

		$this->assertSame( [ 'status' => 'duplicate', 'existing_id' => 7 ], $chains->check( '/a', '/z', '/z' ) );
	}

	public function testCheckIgnoresTheRedirectBeingEdited() {
		$chains = new Chains( [ $this->edge( 7, '/a', '/b' ), $this->edge( 8, '/b', '/a' ) ] );

		// Editing 7 to point elsewhere: its old row is neither a duplicate nor part of a loop.
		$this->assertSame( [ 'status' => 'ok' ], $chains->check( '/a', '/z', '/z', 7 ) );
	}

	public function testLeadingIntoAnExistingLoopIsAWarningNotABlock() {
		$chains = new Chains( [ $this->edge( 1, '/a', '/b' ), $this->edge( 2, '/b', '/a' ) ] );

		$result = $chains->check( '/x', '/a', '/a' );

		$this->assertSame( 'chain', $result['status'] );
		$this->assertSame( [ '/x', '/a', '/b', '/a' ], $result['path'] );
		$this->assertArrayNotHasKey( 'final_target', $result );
	}

	public function testEditingTheFirstOfTwoDuplicatesStillReportsTheSecond() {
		$chains = new Chains( [ $this->edge( 7, '/a', '/b' ), $this->edge( 8, '/a', '/c' ) ] );

		$this->assertSame( [ 'status' => 'duplicate', 'existing_id' => 8 ], $chains->check( '/a', '/z', '/z', 7 ) );
	}
}
