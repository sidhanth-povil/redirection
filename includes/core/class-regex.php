<?php

namespace Redirection\Core;

/**
 * Regular expression helper
 */
class Regex {
	/**
	 * @var string
	 */
	private $pattern;

	/**
	 * @var bool
	 */
	private $case;

	/**
	 * @param string $pattern
	 * @param bool $case_insensitive
	 */
	public function __construct( $pattern, $case_insensitive = false ) {
		$this->pattern = rawurldecode( $pattern );
		$this->case = $case_insensitive;
	}

	/**
	 * Does $target match the regex pattern, applying case insensitivity if set.
	 *
	 * Note: if the pattern is invalid it will not match
	 *
	 * @param string $target Text to match the regex against.
	 * @return boolean match
	 */
	public function is_match( $target ) {
		return @preg_match( $this->get_regex(), $target, $matches ) > 0;
	}

	/**
	 * @param string $path
	 * @return string
	 */
	private function encode_path( $path ) {
		return str_replace( ' ', '%20', $path );
	}

	/**
	 * @param string $path
	 * @return string
	 */
	private function encode_query( $path ) {
		return str_replace( ' ', '+', $path );
	}

	/**
	 * Regex replace the current pattern with $replace_pattern, applied to $target
	 *
	 * Note: if the pattern is invalid it will return $target
	 *
	 * @param string $replace_pattern The regex replace pattern.
	 * @param string $target Text to match the regex against.
	 * @return string Replaced text
	 */
	public function replace( $replace_pattern, $target ) {
		$regex = $this->get_regex();

		// Request text before the match would end up in front of an absolute target and change its host, so drop it
		if ( self::is_absolute_url( $replace_pattern ) && @preg_match( $regex, $target, $found, PREG_OFFSET_CAPTURE ) === 1 && $found[0][1] > 0 ) {
			$target = substr( $target, $found[0][1] );
		}

		$result = @preg_replace( $regex, $replace_pattern, $target );

		if ( is_null( $result ) ) {
			return $target;
		}

		// Space encode the target
		$split = explode( '?', $result );
		if ( count( $split ) === 2 ) {
			$result = implode( '?', [ $this->encode_path( $split[0] ), $this->encode_query( $split[1] ) ] );
		} else {
			$result = $this->encode_path( $result );
		}

		return $result;
	}

	/**
	 * Does the URL name its own host, with a scheme or as protocol relative? A browser treats a backslash as a slash.
	 *
	 * @param string $url URL.
	 * @return bool
	 */
	public static function is_absolute_url( $url ) {
		return preg_match( '@^([a-z][a-z0-9+.-]*:|[/\\\\]{2})@i', $url ) === 1;
	}

	/**
	 * @return string
	 */
	private function get_regex() {
		$at_escaped = str_replace( '@', '\\@', $this->pattern );
		$case = '';

		if ( $this->is_ignore_case() ) {
			$case = 'i';
		}

		return '@' . $at_escaped . '@s' . $case;
	}

	/**
	 * @return bool
	 */
	public function is_ignore_case() {
		return $this->case;
	}
}
