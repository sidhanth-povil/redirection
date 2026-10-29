<?php

use Redirection\ImportExport\ImportService;

class ImportPreflightTest extends WP_UnitTestCase {
	private $group;
	private $file;

	public function setUp(): void {
		parent::setUp();

		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->prefix}redirection_items" );

		$this->group = Red_Group::create( 'preflight', 1 );
		$this->existing( '/taken', '/x' );
		$this->existing( '/middle', '/final' );

		$this->file = wp_tempnam( 'preflight.csv' );
		file_put_contents(
			$this->file,
			implode(
				"\n",
				[
					'"/fine","/page","0","301","url","2",""',
					'"/wp-login.php","/x","0","301","url","2",""',
					'"/taken","/y","0","301","url","2",""',
					'"/dup","/a","0","301","url","2",""',
					'"/dup","/b","0","301","url","2",""',
					'"/hop","/middle","0","301","url","2",""',
				]
			)
		);
	}

	public function tearDown(): void {
		@unlink( $this->file ); // phpcs:ignore
		parent::tearDown();
	}

	private function existing( $url, $target ) {
		Red_Item::create( [ 'url' => $url, 'action_data' => [ 'url' => $target ], 'group_id' => $this->group->get_id(), 'match_type' => 'url', 'action_type' => 'url', 'action_code' => 301 ] );
	}

	private function import( array $options ) {
		$file = [ 'name' => 'preflight.csv', 'tmp_name' => $this->file, 'type' => 'text/csv', 'error' => 0, 'size' => filesize( $this->file ) ];

		return ( new ImportService() )->import( $this->group->get_id(), $file, $options + [ 'format' => 'csv' ] );
	}

	private function issues_by_source( array $result ) {
		$found = [];
		foreach ( $result['problems'] as $problem ) {
			$found[ $problem['source'] ][] = $problem['issue'];
		}

		return $found;
	}

	public function testDryRunFlagsRowsThatWouldFailDuplicateOrChain() {
		$result = $this->import( [ 'dry_run' => true ] );

		$this->assertSame(
			[
				'/wp-login.php' => [ 'invalid' ],
				'/taken' => [ 'duplicate' ],
				'/dup' => [ 'duplicate' ],
				'/hop' => [ 'chain' ],
			],
			$this->issues_by_source( $result )
		);
		$this->assertSame( 4, $result['problem_count'] );
		$this->assertStringContainsString( '/wp-login.php', $result['problems'][0]['message'] );
	}

	public function testSkippingProblemsImportsOnlyRowsThatWouldWork() {
		global $wpdb;

		$result = $this->import( [ 'skip_problems' => true ] );

		$sources = $wpdb->get_col( $wpdb->prepare( "SELECT url FROM {$wpdb->prefix}redirection_items WHERE group_id=%d ORDER BY id", $this->group->get_id() ) );
		// The chain is a warning: /hop still imports, now flagged so someone can flatten it.
		$this->assertSame( [ '/taken', '/middle', '/fine', '/dup', '/hop' ], $sources );
		$this->assertSame( 3, $result['ignored'] );
	}

	public function testAPlainImportIsUnchanged() {
		$result = $this->import( [] );

		$this->assertArrayNotHasKey( 'problems', $result );
	}

	public function testValidatesRowsWhenTheFileNamesItsOwnGroups() {
		$file = [ 'name' => 'preflight.csv', 'tmp_name' => $this->file, 'type' => 'text/csv', 'error' => 0, 'size' => filesize( $this->file ) ];

		$result = ( new ImportService() )->import( 0, $file, [ 'dry_run' => true, 'format' => 'csv' ] );

		$this->assertSame( 4, $result['problem_count'] );
	}
}
