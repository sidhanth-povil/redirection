<?php

require_once PLUGIN_PATH . '/models/url/url-query.php';
require_once PLUGIN_PATH . '/models/url/url-flags.php';
require_once PLUGIN_PATH . '/models/url/url-path.php';
require_once PLUGIN_PATH . '/models/url/url.php';
require_once PLUGIN_PATH . '/models/regex.php';
require_once PLUGIN_PATH . '/includes/core/class-regex.php';

class RegexTest extends TestCase {
	public function testPlainRegex() {
		$regex = new Red_Regex( 'cat.*' );

		$this->assertTrue( $regex->is_match( 'cat5' ) );
		$this->assertFalse( $regex->is_match( 'dog5' ) );
	}

	public function testMalformedRegex() {
		$regex = new Red_Regex( '/cat[5' );

		$this->assertFalse( $regex->is_match( 'cat5' ) );
	}

	public function testCaseRegex() {
		$regex = new Red_Regex( 'cat.*', true );

		$this->assertTrue( $regex->is_match( 'CAT5' ) );
		$this->assertFalse( $regex->is_match( 'DOG5' ) );
	}

	public function testDecode() {
		$regex = new Red_Regex( urlencode( 'für.*' ) );

		$this->assertTrue( $regex->is_match( 'fürcat' ) );
	}

	public function testQuoteRegex() {
		$regex = new Red_Regex( '@cat.*' );

		$this->assertTrue( $regex->is_match( '@cat5' ) );
		$this->assertFalse( $regex->is_match( '@dog5' ) );
	}

	public function testReplace() {
		$regex = new Red_Regex( 'cat(.*)' );

		$this->assertEquals( 'dog5', $regex->replace( 'dog$1', 'cat5' ) );
	}

	public function testPathSpaceReplace() {
		$regex = new Red_Regex( 'cat(.*)' );

		$this->assertEquals( 'dog5%203', $regex->replace( 'dog$1', 'cat5 3' ) );
	}

	public function testQuerySpaceReplace() {
		$regex = new Red_Regex( 'cat(.*)' );

		$this->assertEquals( 'dog5?thing+4', $regex->replace( 'dog$1', 'cat5?thing 4' ) );
	}

	public function testUnanchoredReplaceDropsPrefixBeforeAbsoluteTarget() {
		$regex = new \Redirection\Core\Regex( '/old/(.*)' );

		$this->assertEquals( 'https://example.org/new/x', $regex->replace( 'https://example.org/new/$1', '//attacker.test/z/old/x' ) );
		$this->assertEquals( '//example.org/new/x', $regex->replace( '//example.org/new/$1', '//attacker.test#/old/x' ) );
	}

	public function testTextAfterTheMatchCannotChangeTheHost() {
		$regex = new \Redirection\Core\Regex( '/foo' );

		// Kept request text after an absolute target can become userinfo, a longer host or a port
		$this->assertEquals( 'https://good.com', $regex->replace( 'https://good.com', '/foo@evil.com' ) );
		$this->assertEquals( 'https://good.com', $regex->replace( 'https://good.com', '/foo.evil.com' ) );
		$this->assertEquals( 'https://good.com', $regex->replace( 'https://good.com', '/foo:1@evil.com/foo' ) );
		// A path after the match is still carried, which prefix rules rely on
		$this->assertEquals( 'https://good.com/new/post', $regex->replace( 'https://good.com/new', '/foo/post' ) );
	}

	public function testUnanchoredReplaceKeepsPrefixForRelativeTarget() {
		$regex = new \Redirection\Core\Regex( 'category' );

		$this->assertEquals( '/blog/topics/x', $regex->replace( 'topics', '/blog/category/x' ) );
	}

	public function testMalformedReplace() {
		$regex = new Red_Regex( '/cat[5' );

		$this->assertEquals( 'cat5', $regex->replace( 'dog$1', 'cat5' ) );
	}

	public function testPlusRegex() {
		$regex = new Red_Regex( '^/hello\+world' );

		$this->assertTrue( $regex->is_match( '/hello+world' ) );
	}
}
