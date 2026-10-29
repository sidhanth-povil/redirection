<?php

namespace Redirection\ImportExport;

use Redirection\Health\Chains;
use Redirection\Redirect\Sanitize;

/**
 * Checks each imported row before it is saved, so a 200-row spreadsheet doesn't fail quietly:
 * - invalid: the row would be refused (protected path, bad regex, bad dates…), with the reason
 * - duplicate: the old URL already has a redirect, or appears earlier in the file
 * - chain: the destination is another redirect's old URL, so visitors would take an extra hop
 * Invalid and duplicate rows can be skipped; a chain is only a warning, as skipping one end could break the other.
 */
class ImportPreflight {
	const MAX_PROBLEMS = 100;
	const ISSUE_INVALID = 'invalid';
	const ISSUE_DUPLICATE = 'duplicate';
	const ISSUE_CHAIN = 'chain';

	/**
	 * @var int Existing group used to validate rows whose own group is only created by the import.
	 */
	private $group_id;

	/**
	 * @var RedirectDuplicateMatcher
	 */
	private $duplicates;

	/**
	 * @var Chains
	 */
	private $chains;

	/**
	 * @var array<string, true> Match URLs seen earlier in the file.
	 */
	private $seen = [];

	/**
	 * @var array<string, true> Plain sources earlier in the file, as chain keys.
	 */
	private $file_sources = [];

	/**
	 * @var list<array{source: string, target: string, issue: string, message: string}>
	 */
	private $problems = [];

	/**
	 * @var int
	 */
	private $problem_count = 0;

	/**
	 * @var bool Duplicates are only problems when everything is imported; update and ignore modes handle them.
	 */
	private $checks_duplicates;

	/**
	 * @param int    $group_id Existing group to validate against.
	 * @param string $duplicate_mode The import's duplicate mode.
	 */
	public function __construct( $group_id, $duplicate_mode = 'import' ) {
		$this->checks_duplicates = $duplicate_mode === 'import';

		global $wpdb;

		// Group 0 means "the groups named in the file", which may not exist yet; any real group validates a row.
		$this->group_id = \Red_Group::get( $group_id ) !== false ? $group_id : intval( $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}redirection_groups ORDER BY id LIMIT 1" ), 10 );
		$this->duplicates = new RedirectDuplicateMatcher();
		$this->chains = Chains::load();
	}

	/**
	 * @param array<string, mixed> $redirect Row being imported.
	 * @return list<string> Issues found.
	 */
	public function check( array $redirect ) {
		$source = isset( $redirect['url'] ) && is_string( $redirect['url'] ) ? $redirect['url'] : '';
		$target = isset( $redirect['action_data']['url'] ) && is_string( $redirect['action_data']['url'] ) ? $redirect['action_data']['url'] : '';
		// ponytail: a site with no group at all can't validate rows (the import creates one); they pass unchecked.
		if ( $this->group_id === 0 ) {
			return [];
		}

		$sanitized = ( new Sanitize() )->get( array_merge( $redirect, [ 'group_id' => $this->group_id ] ) );

		if ( is_wp_error( $sanitized ) ) {
			$this->add( $source, $target, self::ISSUE_INVALID, $sanitized->get_error_message() );
			return [ self::ISSUE_INVALID ];
		}

		$issues = [];
		$key = ( $sanitized['regex'] === 1 ? 'regex:' : '' ) . $sanitized['url'];

		// Look up what would be stored: a wildcard is saved as regex and an absolute URL as its path.
		$stored = [ 'url' => $sanitized['url'], 'regex' => $sanitized['regex'] === 1 ];
		if ( $this->checks_duplicates && ( isset( $this->seen[ $key ] ) || $this->duplicates->get_existing_redirect( $stored, 0 ) !== false ) ) {
			$issues[] = self::ISSUE_DUPLICATE;
			$this->add( $source, $target, self::ISSUE_DUPLICATE, __( 'This old URL already has a redirect.', 'dsuite-redirects' ) );
		}
		$this->seen[ $key ] = true;

		if ( $sanitized['regex'] === 0 && Chains::is_followable( $source ) ) {
			$target_key = $target !== '' ? Chains::target_key( $target ) : null;

			if ( $target_key !== null && ( $this->chains->leads_on( $target_key ) || isset( $this->file_sources[ $target_key ] ) ) ) {
				$issues[] = self::ISSUE_CHAIN;
				$this->add( $source, $target, self::ISSUE_CHAIN, __( 'The destination redirects again, so visitors take an extra hop.', 'dsuite-redirects' ) );
			}

			$this->file_sources[ Chains::source_key( $source ) ] = true;
		}

		return $issues;
	}

	/**
	 * @param list<string> $issues From check().
	 * @return bool Whether the row would fail or duplicate, rather than only chain.
	 */
	public static function is_blocking( array $issues ) {
		return count( array_diff( $issues, [ self::ISSUE_CHAIN ] ) ) > 0;
	}

	/**
	 * @return array{problems: list<array{source: string, target: string, issue: string, message: string}>, problem_count: int}
	 */
	public function get_result() {
		return [
			'problems' => $this->problems,
			'problem_count' => $this->problem_count,
		];
	}

	/**
	 * @param string $source Old URL.
	 * @param string $target Destination.
	 * @param string $issue Issue type.
	 * @param string $message Explanation.
	 * @return void
	 */
	private function add( $source, $target, $issue, $message ) {
		$this->problem_count++;

		if ( count( $this->problems ) < self::MAX_PROBLEMS ) {
			$this->problems[] = [ 'source' => $source, 'target' => $target, 'issue' => $issue, 'message' => $message ];
		}
	}
}
