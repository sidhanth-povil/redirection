import { useId } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import IoCard, { type CardMetaItem, type CardStatItem } from 'component/import-export/card';
import type { ImportProblem, ImportStats } from './types';

interface ImportResultsProps {
	activeImportType: 'file' | 'plugin' | 'paste' | null;
	lastImport: ImportStats | false;
	lastImportWasDryRun: boolean | null;
	/** Run the import again for real, skipping rows that would fail or duplicate. */
	onImportClean?: () => void;
}

const getIssueLabels = (): Record< ImportProblem[ 'issue' ], string > => ( {
	invalid: __( 'Would fail', 'dsuite-redirects' ),
	duplicate: __( 'Duplicate', 'dsuite-redirects' ),
	chain: __( 'Extra hop', 'dsuite-redirects' ),
} );

interface ProblemsProps {
	problems: ImportProblem[];
	count: number;
	onImportClean?: () => void;
}

/**
 * The pre-flight's findings for a file preview. A chain only warns, so skipping is offered for failing or duplicate rows.
 *
 * @param props
 * @param props.problems      Problems found (capped by the server).
 * @param props.count         Total problems, including any beyond the cap.
 * @param props.onImportClean Import without blocking rows.
 */
function ImportProblems( { problems, count, onImportClean }: ProblemsProps ) {
	const headingId = useId();
	const labels = getIssueLabels();
	const canSkip = onImportClean !== undefined && problems.some( ( problem ) => problem.issue !== 'chain' );

	return (
		<section className="dsr-import-problems" aria-labelledby={ headingId }>
			<h3 id={ headingId }>
				{ sprintf(
					/* translators: %d: number of rows with problems */
					_n( '%d row needs a look', '%d rows need a look', count, 'dsuite-redirects' ),
					count
				) }
			</h3>
			<ul>
				{ problems.map( ( problem, index ) => (
					<li
						key={ `${ problem.source }-${ problem.issue }-${ index }` }
						className={ `is-${ problem.issue }` }
					>
						<strong>{ labels[ problem.issue ] }</strong> <code>{ problem.source }</code> →{ ' ' }
						<code>{ problem.target || '–' }</code>
						<span className="dsr-import-problems__message">{ problem.message }</span>
					</li>
				) ) }
			</ul>
			{ canSkip && (
				<button type="button" className="button button-primary" onClick={ onImportClean }>
					{ __( 'Import, skipping rows that would fail or duplicate', 'dsuite-redirects' ) }
				</button>
			) }
		</section>
	);
}

function ImportResults( { activeImportType, lastImport, lastImportWasDryRun, onImportClean }: ImportResultsProps ) {
	if ( lastImport === false ) {
		return null;
	}

	const isPreview = lastImportWasDryRun === true;
	let details: CardMetaItem[] = [];

	if ( lastImport.created === 0 && lastImport.updated === 0 && lastImport.ignored > 0 ) {
		details = [
			{
				label: __( 'Status', 'dsuite-redirects' ),
				value: isPreview
					? __( 'All matching redirects would be ignored.', 'dsuite-redirects' )
					: __( 'All matching redirects were ignored.', 'dsuite-redirects' ),
			},
		];
	} else if (
		lastImport.created === 0 &&
		lastImport.updated === 0 &&
		lastImport.groups_created === 0 &&
		lastImport.groups_updated === 0 &&
		lastImport.groups_ignored === 0 &&
		lastImport.logs_imported === 0 &&
		lastImport.errors_imported === 0 &&
		lastImport.settings_imported === 0
	) {
		details = [
			{
				label: __( 'Status', 'dsuite-redirects' ),
				value: isPreview
					? __( 'No redirects were found to preview.', 'dsuite-redirects' )
					: __( 'No redirects were imported.', 'dsuite-redirects' ),
			},
		];
	}

	if ( isPreview ) {
		details = details.concat( [
			{
				label: __( 'Mode', 'dsuite-redirects' ),
				value: __( 'Preview only. No changes have been made.', 'dsuite-redirects' ),
			},
		] );
	}

	const stats: CardStatItem[] = [
		{
			label: _n( 'Redirect created', 'Redirects created', lastImport.created, 'dsuite-redirects' ),
			value: lastImport.created,
		},
		{
			label: _n( 'Redirect updated', 'Redirects updated', lastImport.updated, 'dsuite-redirects' ),
			value: lastImport.updated,
		},
		{
			label: _n( 'Redirect ignored', 'Redirects ignored', lastImport.ignored, 'dsuite-redirects' ),
			value: lastImport.ignored,
		},
		{
			label: _n( 'Group created', 'Groups created', lastImport.groups_created, 'dsuite-redirects' ),
			value: lastImport.groups_created,
		},
		{
			label: _n( 'Group updated', 'Groups updated', lastImport.groups_updated, 'dsuite-redirects' ),
			value: lastImport.groups_updated,
		},
		{
			label: _n( 'Group ignored', 'Groups ignored', lastImport.groups_ignored, 'dsuite-redirects' ),
			value: lastImport.groups_ignored,
		},
		{
			label: _n( 'Log imported', 'Logs imported', lastImport.logs_imported, 'dsuite-redirects' ),
			value: lastImport.logs_imported,
		},
		{
			label: _n( '404 log imported', '404 logs imported', lastImport.errors_imported, 'dsuite-redirects' ),
			value: lastImport.errors_imported,
		},
		{
			label: _n( 'Setting imported', 'Settings imported', lastImport.settings_imported, 'dsuite-redirects' ),
			value: lastImport.settings_imported,
		},
	];

	const getViewRedirectUrl = ( redirectId?: number ) => {
		if ( ! redirectId ) {
			return '';
		}

		return window.Redirectioni10n.pluginRoot + '&' + encodeURIComponent( 'filterby[id]' ) + '=' + redirectId;
	};

	const renderSource = ( row: ImportStats[ 'preview' ][ number ] ) => {
		if ( row.result === 'updated' && row.redirect_id ) {
			return <a href={ getViewRedirectUrl( row.redirect_id ) }>{ row.source || ' ' }</a>;
		}

		return row.source || ' ';
	};

	return (
		<div className="file-sniff">
			<IoCard
				title={
					isPreview ? __( 'Preview results', 'dsuite-redirects' ) : __( 'Import results', 'dsuite-redirects' )
				}
				badge={ __( 'Success', 'dsuite-redirects' ) }
				meta={ details }
				stats={ stats }
				variant="success"
			>
				{ isPreview && ( lastImport.problem_count ?? 0 ) > 0 && (
					<ImportProblems
						problems={ lastImport.problems ?? [] }
						count={ lastImport.problem_count ?? 0 }
						{ ...( onImportClean ? { onImportClean } : {} ) }
					/>
				) }
				{ activeImportType !== null && lastImport.preview.length > 0 && (
					<div className="io-preview-table">
						<table className="wp-list-table widefat fixed striped items table-auto inline-edit-row">
							<thead>
								<tr>
									<th>{ __( 'Source', 'dsuite-redirects' ) }</th>
									<th>{ __( 'Target', 'dsuite-redirects' ) }</th>
									<th className="io-preview-table__code">{ __( 'HTTP', 'dsuite-redirects' ) }</th>
									<th className="io-preview-table__regex">{ __( 'Regex', 'dsuite-redirects' ) }</th>
									<th>{ __( 'Group', 'dsuite-redirects' ) }</th>
								</tr>
							</thead>
							<tbody>
								{ lastImport.preview.map( ( row, index ) => (
									<tr
										key={ `${ row.source }-${ row.target }-${ index }` }
										className={
											row.result === 'ignored' ? 'io-preview-table__row--ignored' : undefined
										}
									>
										<td>{ renderSource( row ) }</td>
										<td>{ row.target || ' ' }</td>
										<td className="io-preview-table__code">{ row.code || '' }</td>
										<td className="io-preview-table__regex">
											{ row.regex
												? __( 'Yes', 'dsuite-redirects' )
												: __( 'No', 'dsuite-redirects' ) }
										</td>
										<td>{ row.group || '' }</td>
									</tr>
								) ) }
							</tbody>
						</table>
					</div>
				) }
			</IoCard>
		</div>
	);
}

export default ImportResults;
