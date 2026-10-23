<?php

namespace Redirection\Url;

/**
 * Simple `*` wildcards for marketers: `/blog/*` matches everything under /blog/.
 * Pure (no WordPress) so it can be unit tested; literal parts are always preg_quote'd, so input can't inject regex.
 */
class Wildcard {
	const DELIMITER = '@';

	/**
	 * Compile a wildcard source into an anchored regex. Each `*` becomes a `(.*)` capture.
	 *
	 * @param string $source Source URL as typed, e.g. `/blog/*`.
	 * @param bool   $ignore_case Case-insensitive match.
	 * @return string
	 */
	public static function to_regex( $source, $ignore_case = false ) {
		$literals = array_map(
			static function ( $part ) {
				return preg_quote( $part, self::DELIMITER );
			},
			explode( '*', $source )
		);

		return self::DELIMITER . '^' . implode( '(.*)', $literals ) . '$' . self::DELIMITER . 's' . ( $ignore_case ? 'i' : '' );
	}

	/**
	 * The same pattern without delimiters or flags, for server config (Apache/Nginx) rules.
	 *
	 * @param string $source Source URL as typed.
	 * @return string
	 */
	public static function to_pattern( $source ) {
		return '^' . implode( '(.*)', array_map( 'preg_quote', explode( '*', $source ) ) ) . '$';
	}

	/**
	 * Fill each `*` in the target with the matching capture, in order. Extra `*`s become empty.
	 *
	 * @param string        $target Target URL, e.g. `/news/*`.
	 * @param array<string> $captures Captured values.
	 * @return string
	 */
	public static function apply_target( $target, array $captures ) {
		$parts = explode( '*', $target );
		$result = (string) array_shift( $parts );

		foreach ( array_values( $parts ) as $index => $part ) {
			$result .= ( $captures[ $index ] ?? '' ) . $part;
		}

		return $result;
	}

	/**
	 * The target as a regex replacement (`*` → `$1`, `$2`…) with literal `\` and `$` escaped.
	 *
	 * @param string                          $target Target URL.
	 * @param (callable(string): string)|null $encode Applied to each literal part first, e.g. to percent-encode for server config.
	 * @return string
	 */
	public static function to_replacement( $target, $encode = null ) {
		$parts = array_map(
			static function ( $part ) use ( $encode ) {
				$part = $encode !== null ? $encode( $part ) : $part;

				return str_replace( [ '\\', '$' ], [ '\\\\', '\\$' ], $part );
			},
			explode( '*', $target )
		);
		$result = (string) array_shift( $parts );

		foreach ( array_values( $parts ) as $index => $part ) {
			$result .= '$' . ( $index + 1 ) . $part;
		}

		return $result;
	}
}
