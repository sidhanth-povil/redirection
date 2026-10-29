<?php

namespace Redirection\ImportExport;

/**
 * Import redirects from uploaded files.
 *
 * @phpstan-import-type ImportResult from \Redirection\ImportExport\FormatHandler
 */
class ImportService {
	/**
	 * @var FormatFactory
	 */
	private $formats;

	/**
	 * @var callable(int, string): (ImportPreflight|null)
	 */
	private $preflight_factory;

	/**
	 * @param FormatFactory|null                         $formats
	 * @param (callable(int, string): (ImportPreflight|null))|null $preflight_factory Builds row checks for a group; null skips them.
	 */
	public function __construct( ?FormatFactory $formats = null, ?callable $preflight_factory = null ) {
		$this->formats = $formats ? $formats : new FormatFactory();
		$this->preflight_factory = $preflight_factory ?? static function ( $group_id, $duplicate_mode ) {
			return new ImportPreflight( $group_id, $duplicate_mode );
		};
	}

	/**
	 * @param int $group_id Group ID to import into.
	 * @param array{name: string, tmp_name: string, type: string, error: int, size: int} $file
	 * @param array<string, bool|string|array<int, string>> $options Import options.
	 * @return ImportResult
	 */
	public function import( $group_id, array $file, array $options = [] ) {
		$group = new ImportGroup( $group_id, $options );
		$redirect = new ImportRedirect( $options );
		$skip_problems = isset( $options['skip_problems'] ) && $options['skip_problems'] === true;
		$is_dry_run = isset( $options['dry_run'] ) && $options['dry_run'] === true;
		$duplicate_mode = isset( $options['duplicate_mode'] ) && is_string( $options['duplicate_mode'] ) ? $options['duplicate_mode'] : 'import';
		$preflight = $skip_problems || $is_dry_run ? ( $this->preflight_factory )( $group_id, $duplicate_mode ) : null;
		if ( $preflight !== null ) {
			$redirect->set_preflight( $preflight, $skip_problems );
		}
		$importer = null;

		if ( isset( $options['format'] ) && is_string( $options['format'] ) ) {
			$importer = $this->formats->create( $options['format'] );
		}

		if ( $importer === false || $importer === null ) {
			$importer = $this->formats->create_importer_for_filename( $file['name'] );
		}

		return $importer->load(
			$group,
			$redirect,
			$file['tmp_name'],
			isset( $options['dry_run'] ) ? $options['dry_run'] === true : false,
			$options
		);
	}
}
