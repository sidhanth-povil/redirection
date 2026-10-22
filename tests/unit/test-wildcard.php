<?php

use Redirection\Url\Wildcard;

require_once PLUGIN_PATH . '/includes/url/class-wildcard.php';

class WildcardTest extends TestCase {
	public function testSingleWildcardCapturesTheRest() {
		$regex = Wildcard::to_regex( '/blog/*' );

		$this->assertSame( 1, preg_match( $regex, '/blog/2024/hello', $matches ) );
		$this->assertSame( '2024/hello', $matches[1] );
		$this->assertSame( 0, preg_match( $regex, '/news/blog/x' ) );
	}

	public function testMultipleWildcardsCaptureInOrder() {
		$regex = Wildcard::to_regex( '/shop/*/item-*' );

		$this->assertSame( 1, preg_match( $regex, '/shop/shoes/item-42', $matches ) );
		$this->assertSame( [ 'shoes', '42' ], array_slice( $matches, 1 ) );
	}

	public function testLiteralPartsCannotActAsRegex() {
		$regex = Wildcard::to_regex( '/a.b/(x)+[y]?*' );

		$this->assertSame( 1, preg_match( $regex, '/a.b/(x)+[y]?anything' ) );
		$this->assertSame( 0, preg_match( $regex, '/axb/(x)+[y]?anything' ) );
		$this->assertSame( 0, preg_match( $regex, '/a.b/xx[y]anything' ) );
	}

	public function testIsAnchoredAndHonoursTheCaseFlag() {
		$this->assertSame( 0, preg_match( Wildcard::to_regex( '/blog/*' ), '/BLOG/x' ) );
		$this->assertSame( 1, preg_match( Wildcard::to_regex( '/blog/*', true ), '/BLOG/x' ) );
		$this->assertSame( 0, preg_match( Wildcard::to_regex( '/blog/*' ), 'prefix/blog/x' ) );
	}

	public function testApplyTargetFillsWildcardsInOrder() {
		$this->assertSame( '/news/2024/hello', Wildcard::apply_target( '/news/*', [ '2024/hello' ] ) );
		$this->assertSame( '/c/42/shoes', Wildcard::apply_target( '/c/*/*', [ '42', 'shoes' ] ) );
		$this->assertSame( '/c/42/', Wildcard::apply_target( '/c/*/*', [ '42' ] ) );
		$this->assertSame( '/landing', Wildcard::apply_target( '/landing', [ 'ignored' ] ) );
		$this->assertSame( '/p/$1', Wildcard::apply_target( '/p/*', [ '$1' ] ) );
	}

	public function testToReplacementForServerConfig() {
		$this->assertSame( '/news/$1', Wildcard::to_replacement( '/news/*' ) );
		$this->assertSame( '/c/$1/$2', Wildcard::to_replacement( '/c/*/*' ) );
		$this->assertSame( '/price\\$5/$1', Wildcard::to_replacement( '/price$5/*' ) );
	}
}
