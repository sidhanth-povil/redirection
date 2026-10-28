<?php

namespace Redirection\ImportExport\Format;

use Redirection\ImportExport\FormatHandler;
use Redirection\ImportExport\ImportRedirect;

/**
 * @phpstan-import-type GroupExport from \Red_Group
 * @phpstan-import-type ImportResult from \Redirection\ImportExport\FormatHandler
 * @phpstan-import-type RedirectMatchData from \Red_Item
 *
 * @phpstan-type SourceMatchOptions array{
 *   flag_query?: 'ignore'|'exact'|'pass'|'exactorder',
 *   flag_case?: bool,
 *   flag_trailing?: bool,
 *   flag_regex?: bool
 * }
 */
class Nginx extends FormatHandler {
	public function force_download() {
		parent::force_download();

		header( 'Content-Type: application/octet-stream' );
		header( 'Content-Disposition: attachment; filename="' . $this->export_filename( 'nginx' ) . '"' );
	}

	/**
	 * @param array<\Red_Item> $items
	 * @param array<GroupExport> $groups
	 * @return string
	 */
	public function get_data( array $items, array $groups ) {
		$lines = [];
		$details = $this->get_export_details();

		$lines[] = '# Created by Redirection';
		$lines[] = '# ' . $details['date'];
		$lines[] = '# DSuite Redirects ' . $details['version'];
		$lines[] = '';
		$lines[] = 'server {';

		$parts = [];
		foreach ( $items as $item ) {
			// Server config can't switch rules on and off by date, so scheduled redirects stay in WordPress.
			// @phpstan-ignore method.notFound (Red_Item aliases Redirection\Redirect\Redirect at runtime; phpstan also sees the legacy models/ class)
			if ( $item->is_enabled() && ! $item->has_schedule() ) {
				$parts[] = $this->get_nginx_item( $item );
			}
		}

		$lines = array_merge(
			$lines,
			array_filter(
				$parts,
				static function ( $part ) {
					return is_string( $part ) && $part !== '';
				}
			)
		);

		$lines[] = '}';
		$lines[] = '';
		$lines[] = '# End of Redirection';

		return implode( PHP_EOL, $lines ) . PHP_EOL;
	}

	/**
	 * @param \Red_Item $item
	 * @return 'permanent'|'redirect'
	 */
	private function get_redirect_code( $item ) {
		if ( $item->get_action_code() === 301 ) {
			return 'permanent';
		}

		return 'redirect';
	}

	/**
	 * @param mixed $group Group resolver.
	 * @param ImportRedirect $redirect Redirect saver.
	 * @param string $filename Path to the file to import.
	 * @param bool $is_dry_run Whether this is a dry run.
	 * @return ImportResult
	 */
	public function load( $group, $redirect, $filename, $is_dry_run, array $options = [] ) {
		unset( $options );
		return $this->get_import_result( $group, $redirect );
	}

	/**
	 * @param \Red_Item $item
	 * @return string|false
	 */
	private function get_nginx_item( $item ) {
		$match_data = $item->get_match_data();
		$match_data = is_array( $match_data ) ? $match_data : [];
		$line = false;

		switch ( $item->get_match_type() ) {
			case 'url':
				$line = $this->add_url( $item, $match_data );
				break;

			case 'agent':
				$line = $this->add_agent( $item, $match_data );
				break;

			case 'referrer':
				$line = $this->add_referrer( $item, $match_data );
				break;
		}

		if ( is_string( $line ) && $line !== '' ) {
			return '    ' . $line;
		}

		return false;
	}

	/**
	 * @param \Red_Item $item
	 * @param RedirectMatchData $match_data
	 * @return string
	 */
	private function add_url( $item, array $match_data ) {
		/** @var SourceMatchOptions|null $source */
		$source = isset( $match_data['source'] ) && is_array( $match_data['source'] ) ? $match_data['source'] : null;
		$regex = $item->source_flags !== null && $item->source_flags->is_regex();

		if ( $item->get_action_type() === 'error' ) {
			return $this->get_error_location( $item->get_url(), $item->get_action_code(), $source, $regex );
		}

		// @phpstan-ignore method.notFound (Red_Item aliases Redirection\Redirect\Redirect at runtime; phpstan also sees the legacy models/ class)
		if ( $item->is_wildcard() ) {
			// A wildcard is exported as its compiled regex, with each * in the target as $1, $2...
			// Written directly: Red_Url_Encode would percent-encode preg_quote's backslashes and drop the leading /,
			// and nginx matches against $uri, which always starts with /. Quoted because the pattern may contain { }.
			$case = isset( $source['flag_case'] ) && $source['flag_case'] ? '(?i)' : '';
			$from = $case . \Redirection\Url\Wildcard::to_pattern( $item->get_url() );

			// The target is unquoted, so its literal parts are percent-encoded like get_redirect() does: a space, ; or }
			// in a target must not end the directive and add new ones.
			$to = \Redirection\Url\Wildcard::to_replacement(
				$item->get_action_data(),
				static function ( $part ) {
					return ( new \Red_Url_Encode( $part ) )->get_as_target();
				}
			);

			return 'rewrite "' . str_replace( '"', '\\"', $from ) . '" ' . $to . ' ' . $this->get_redirect_code( $item ) . ';';
		}

		return $this->get_redirect( $item->get_url(), $item->get_action_data(), $this->get_redirect_code( $item ), $source, $regex );
	}

	/**
	 * @param \Red_Item $item
	 * @param RedirectMatchData $match_data
	 * @return string
	 */
	private function add_agent( $item, array $match_data ) {
		$lines = [];
		/** @var SourceMatchOptions|null $source */
		$source = isset( $match_data['source'] ) && is_array( $match_data['source'] ) ? $match_data['source'] : null;

		$match = $item->match;
		if ( ! ( $match instanceof \Redirection\Compare\Agent ) ) {
			return '';
		}

		if ( $match->url_from !== '' ) {
			$lines[] = 'if ( $http_user_agent ~* ' . $this->quote_regex( $match->agent ) . ' ) {';
			$lines[] = '        ' . $this->get_conditional_action( $item, $item->get_url(), $match->url_from, $source );
			$lines[] = '    }';
		}

		if ( $match->url_notfrom !== '' ) {
			$lines[] = 'if ( $http_user_agent !~* ' . $this->quote_regex( $match->agent ) . ' ) {';
			$lines[] = '        ' . $this->get_conditional_action( $item, $item->get_url(), $match->url_notfrom, $source );
			$lines[] = '    }';
		}

		return implode( "\n", $lines );
	}

	/**
	 * @param \Red_Item $item
	 * @param RedirectMatchData $match_data
	 * @return string
	 */
	private function add_referrer( $item, array $match_data ) {
		$lines = [];
		/** @var SourceMatchOptions|null $source */
		$source = isset( $match_data['source'] ) && is_array( $match_data['source'] ) ? $match_data['source'] : null;

		$match = $item->match;
		if ( ! ( $match instanceof \Redirection\Compare\Referrer ) ) {
			return '';
		}

		if ( $match->url_from !== '' ) {
			$lines[] = 'if ( $http_referer ~* ' . $this->quote_regex( $match->referrer ) . ' ) {';
			$lines[] = '        ' . $this->get_conditional_action( $item, $item->get_url(), $match->url_from, $source );
			$lines[] = '    }';
		}

		if ( $match->url_notfrom !== '' ) {
			$lines[] = 'if ( $http_referer !~* ' . $this->quote_regex( $match->referrer ) . ' ) {';
			$lines[] = '        ' . $this->get_conditional_action( $item, $item->get_url(), $match->url_notfrom, $source );
			$lines[] = '    }';
		}

		return implode( "\n", $lines );
	}

	/**
	 * @param string $line
	 * @param string $target
	 * @param 'permanent'|'redirect' $code
	 * @param SourceMatchOptions|null $source
	 * @param bool $regex
	 * @return string
	 */
	private function get_redirect( $line, $target, $code, $source, $regex = false ) {
		$line = ltrim( $line, '^' );
		$line = rtrim( $line, '$' );

		$source_url = new \Red_Url_Encode( $line, $regex );
		$target_url = new \Red_Url_Encode( $target );

		$from = $source_url->get_as_source();
		$from = ltrim( $from, '^' );
		$from = rtrim( $from, '$' );

		if ( isset( $source['flag_case'] ) && $source['flag_case'] ) {
			$from = '(?i)^' . $from;
		} else {
			$from = '^' . $from;
		}

		return 'rewrite ' . $from . '$ ' . $target_url->get_as_target() . ' ' . $code . ';';
	}

	/**
	 * @param \Red_Item $item
	 * @param string $line
	 * @param string $target
	 * @param SourceMatchOptions|null $source
	 * @return string
	 */
	private function get_conditional_action( $item, $line, $target, $source ) {
		if ( $item->get_action_type() === 'error' ) {
			return $this->get_error_return( $item->get_action_code() );
		}

		return $this->get_redirect( $line, $target, $this->get_redirect_code( $item ), $source );
	}

	/**
	 * @param string $line
	 * @param int $code
	 * @param SourceMatchOptions|null $source
	 * @param bool $regex
	 * @return string
	 */
	private function get_error_location( $line, $code, $source, $regex = false ) {
		return implode(
			"\n",
			[
				$this->get_location_line( $line, $source, $regex ) . ' {',
				'        ' . $this->get_error_return( $code ),
				'    }',
			]
		);
	}

	/**
	 * @param string $line
	 * @param SourceMatchOptions|null $source
	 * @param bool $regex
	 * @return string
	 */
	private function get_location_line( $line, $source, $regex = false ) {
		if ( $regex || ( isset( $source['flag_case'] ) && $source['flag_case'] ) ) {
			if ( ! $regex ) {
				$line = ltrim( $line, '^' );
				$line = rtrim( $line, '$' );
			}

			$source_url = new \Red_Url_Encode( $line, $regex );
			$from = $source_url->get_as_source();
			$from = ltrim( $from, '^' );
			$from = rtrim( $from, '$' );
			$from = (string) preg_replace( '/^%5E/', '', $from );

			return 'location ' . ( isset( $source['flag_case'] ) && $source['flag_case'] ? '~* ' : '~ ' ) . '^' . $from . '$';
		}

		$source_url = new \Red_Url_Encode( $line );

		return 'location = ' . $source_url->get_as_target();
	}

	/**
	 * Quote a user agent or referrer regex for an nginx if. Unquoted, a space, ) or { in it would end the condition
	 * and the rest would become nginx configuration. A quote or control character cannot be kept safely, so is removed.
	 *
	 * @param string $regex Regex.
	 * @return string
	 */
	private function quote_regex( $regex ) {
		return '"^' . (string) preg_replace( '/["\x00-\x1F\x7F]/', '', $regex ) . '$"';
	}

	/**
	 * @param int $code
	 * @return string
	 */
	private function get_error_return( $code ) {
		return 'return ' . intval( $code, 10 ) . ';';
	}
}
