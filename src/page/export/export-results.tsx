import { __ } from '@wordpress/i18n';
import IoCard, { type CardMetaItem, type CardStatItem } from 'component/import-export/card';
import { getExportFormatLabel, getExportTypesLabel } from './export-helpers';
import type { ExportResult } from './types';

interface ExportResultsProps {
	lastResult: ExportResult | false;
}

function formatNumber( value: number ) {
	const locale = window.Redirectioni10n?.locale || undefined;

	return new Intl.NumberFormat( locale ).format( value );
}

function formatFileSize( size: number ) {
	if ( size < 1024 ) {
		return `${ size } B`;
	}

	if ( size < 1024 * 1024 ) {
		return `${ ( size / 1024 ).toFixed( 1 ) } KB`;
	}

	return `${ ( size / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
}

function getFileSize( data: string ) {
	return new Blob( [ data ] ).size;
}

function ExportResults( { lastResult }: ExportResultsProps ) {
	if ( lastResult === false ) {
		return null;
	}

	const details: CardMetaItem[] = [
		{
			label: __( 'Action', 'dsuite-redirects' ),
			value:
				lastResult.action === 'view'
					? __( 'Viewed in browser', 'dsuite-redirects' )
					: __( 'Downloaded', 'dsuite-redirects' ),
		},
		{
			label: __( 'Format', 'dsuite-redirects' ),
			value: getExportFormatLabel( lastResult.format ),
		},
		{
			label: __( 'Export', 'dsuite-redirects' ),
			value: getExportTypesLabel( lastResult.types ),
		},
		{
			label: __( 'File size', 'dsuite-redirects' ),
			value: formatFileSize( getFileSize( lastResult.data ) ),
		},
	];
	const stats: CardStatItem[] = [];

	if ( lastResult.total !== null ) {
		const exportedCount = lastResult.exported ?? lastResult.total - ( lastResult.skipped ?? 0 );

		stats.push( {
			label: __( 'Items exported', 'dsuite-redirects' ),
			value: formatNumber( exportedCount ),
		} );
	}

	if ( lastResult.skipped ) {
		stats.push( {
			label: __( 'Skipped (unsupported for this format)', 'dsuite-redirects' ),
			value: formatNumber( lastResult.skipped ),
		} );
	}

	return (
		<div className="export-results">
			<IoCard
				title={
					lastResult.action === 'view'
						? __( 'View results', 'dsuite-redirects' )
						: __( 'Download ready', 'dsuite-redirects' )
				}
				badge={ __( 'Success', 'dsuite-redirects' ) }
				meta={ details }
				stats={ stats }
				variant="success"
			>
				{ lastResult.action === 'view' && (
					<textarea className="module-export" rows={ 14 } readOnly={ true } value={ lastResult.data } />
				) }
			</IoCard>
		</div>
	);
}

export default ExportResults;
