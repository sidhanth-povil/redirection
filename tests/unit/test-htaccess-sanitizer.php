<?php

require_once PLUGIN_PATH . '/includes/import-export/sanitizer/class-htaccess-sanitizer.php';

use Redirection\ImportExport\Sanitizer\HtaccessSanitizer;

class HtaccessSanitizerTest extends TestCase {
	private function get_sanitizer() {
		return new HtaccessSanitizer();
	}

	public function testSanitizeRegexPreservesOptionalRegexSuffix() {
		$this->assertEquals( '^contact-us(/.*)?$', $this->get_sanitizer()->sanitize_regex( '^/contact-us(/.*)?$' ) );
	}

	public function testSanitizeRegexStripsUnsafeCharacters() {
		$this->assertEquals( '^', $this->get_sanitizer()->sanitize_regex( "^\t/thing value\nignored" ) );
	}

	public function testSanitizeRegexKeepsTheRuleOneArgument() {
		// Apache splits arguments on any ASCII space, so a vertical tab or form feed could add a flag such as H=
		$regex = $this->get_sanitizer()->sanitize_regex( "^up\x0Bx.jpg\x0C[H=application/x-httpd-php]$" );

		$this->assertDoesNotMatchRegularExpression( '/\s/', $regex );
	}

	public function testSanitizeRedirectRemovesUnsafeSequences() {
		$this->assertEquals( 'RewriteRuletestalert(1)', $this->get_sanitizer()->sanitize_redirect( "RewriteRule\ttest\t<?alert(1)>" ) );
	}
}
