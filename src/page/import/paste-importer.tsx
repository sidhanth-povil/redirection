import { __, _n } from '@wordpress/i18n';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import IoCard, { type CardMetaItem, type CardStatItem } from 'component/import-export/card';
import type { ImportSniffResult } from './types';

type CsvFileInfo = Extract< ImportSniffResult, { format: 'csv' } >;
type ApacheFileInfo = Extract< ImportSniffResult, { format: 'apache' } >;

interface PasteImporterProps {
	activeImportType: 'file' | 'paste' | 'plugin' | null;
	isImporting: boolean;
	pasteInfo: ImportSniffResult | null;
	pasteText: string;
	onClearPaste: () => void;
	onPasteTextChange: ( value: string ) => void;
	onSelect: () => void;
}

function PasteImporter( {
	activeImportType,
	isImporting,
	pasteInfo,
	pasteText,
	onClearPaste,
	onPasteTextChange,
	onSelect,
}: PasteImporterProps ) {
	const isActive = activeImportType === 'paste' && pasteText.trim().length > 0;

	const getErrorMessage = () => {
		if ( pasteInfo?.error === 'not-redirection-json' ) {
			return __( 'Not a Redirection JSON export', 'dsuite-redirects' );
		}

		if ( pasteInfo?.error === 'invalid-json' ) {
			return __( 'Invalid JSON', 'dsuite-redirects' );
		}

		if ( pasteInfo?.error === 'empty-csv' ) {
			return __( 'Empty CSV content', 'dsuite-redirects' );
		}

		if ( pasteInfo?.error === 'separator-not-detected' ) {
			return __( 'Unable to detect a CSV separator', 'dsuite-redirects' );
		}

		if ( pasteInfo?.error === 'unknown-csv-layout' ) {
			return __( 'Unknown CSV layout', 'dsuite-redirects' );
		}

		if ( pasteInfo?.error === 'unknown-apache-layout' ) {
			return __( 'Unknown Apache .htaccess layout', 'dsuite-redirects' );
		}

		if ( pasteInfo?.error === 'unknown-redirects-file-layout' ) {
			return __(
				"This doesn't look like a valid _redirects file — check the from/to/status syntax on each line.",
				'dsuite-redirects'
			);
		}

		return __( 'Unsupported pasted content', 'dsuite-redirects' );
	};

	const getSeparatorText = () => {
		if ( pasteInfo?.format !== 'csv' || ! pasteInfo.separator ) {
			return '';
		}

		if ( pasteInfo.separator === ',' ) {
			return __( 'Comma', 'dsuite-redirects' );
		}

		if ( pasteInfo.separator === ';' ) {
			return __( 'Semicolon', 'dsuite-redirects' );
		}

		if ( pasteInfo.separator === '|' ) {
			return __( 'Pipe', 'dsuite-redirects' );
		}

		return __( 'Tab', 'dsuite-redirects' );
	};

	const getContentSize = () => {
		const bytes = new Blob( [ pasteText ] ).size;

		if ( bytes < 1024 ) {
			return `${ bytes } B`;
		}

		if ( bytes < 1024 * 1024 ) {
			return `${ ( bytes / 1024 ).toFixed( 1 ) } KB`;
		}

		return `${ ( bytes / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
	};

	const getCsvRowLabel = ( csvFileInfo: CsvFileInfo, rows: number ) => {
		if ( csvFileInfo.type === 'groups' ) {
			return _n( 'Group', 'Groups', rows, 'dsuite-redirects' );
		}

		if ( csvFileInfo.type === 'logs' ) {
			return _n( 'Log', 'Logs', rows, 'dsuite-redirects' );
		}

		if ( csvFileInfo.type === 'errors_404' ) {
			return _n( '404 log', '404 logs', rows, 'dsuite-redirects' );
		}

		return _n( 'Redirect', 'Redirects', rows, 'dsuite-redirects' );
	};

	const getApacheRuleLabel = ( apacheFileInfo: ApacheFileInfo, rules: number ) => {
		if ( apacheFileInfo.ruleTypes?.includes( 'rewrite' ) && apacheFileInfo.ruleTypes.length === 1 ) {
			return _n( 'Rewrite rule', 'Rewrite rules', rules, 'dsuite-redirects' );
		}

		if ( apacheFileInfo.ruleTypes?.includes( 'redirect' ) && apacheFileInfo.ruleTypes.length === 1 ) {
			return _n( 'Redirect rule', 'Redirect rules', rules, 'dsuite-redirects' );
		}

		if ( apacheFileInfo.ruleTypes?.includes( 'redirectmatch' ) && apacheFileInfo.ruleTypes.length === 1 ) {
			return _n( 'RedirectMatch rule', 'RedirectMatch rules', rules, 'dsuite-redirects' );
		}

		return _n( 'Apache rule', 'Apache rules', rules, 'dsuite-redirects' );
	};

	const getRedirectsFileRuleLabel = ( rules: number ) => {
		return _n( 'Redirect rule', 'Redirect rules', rules, 'dsuite-redirects' );
	};

	const getMeta = (): CardMetaItem[] => {
		const meta: CardMetaItem[] = [
			{
				label: __( 'Import type', 'dsuite-redirects' ),
				value: __( 'Paste redirects or export data', 'dsuite-redirects' ),
			},
			{
				label: __( 'Supported formats', 'dsuite-redirects' ),
				value: __( 'CSV, JSON, .htaccess, and _redirects', 'dsuite-redirects' ),
			},
		];

		if ( pasteText.trim().length === 0 || pasteInfo === null || ! pasteInfo.valid ) {
			return meta;
		}

		let importTypeValue: ReactNode = __( 'CSV', 'dsuite-redirects' );
		if ( pasteInfo.format === 'json' ) {
			importTypeValue = __( 'JSON', 'dsuite-redirects' );
		} else if ( pasteInfo.format === 'apache' ) {
			importTypeValue = __( 'Apache .htaccess', 'dsuite-redirects' );
		} else if ( pasteInfo.format === 'redirects-file' ) {
			importTypeValue = __( '_redirects', 'dsuite-redirects' );
		}

		meta[ 0 ] = {
			label: __( 'Import type', 'dsuite-redirects' ),
			value: importTypeValue,
		};
		meta[ 1 ] = {
			label: __( 'Details', 'dsuite-redirects' ),
			value: getContentSize(),
		};

		if ( pasteInfo.format === 'json' && pasteInfo.version ) {
			meta.push( {
				label: __( 'Plugin version', 'dsuite-redirects' ),
				value: pasteInfo.version,
			} );
		}

		if ( pasteInfo.format === 'csv' ) {
			meta.push( {
				label: __( 'Separator', 'dsuite-redirects' ),
				value: getSeparatorText(),
			} );
		}

		if ( pasteInfo.format === 'apache' ) {
			meta.push( {
				label: __( 'Contains', 'dsuite-redirects' ),
				value: __( 'Apache redirect rules', 'dsuite-redirects' ),
			} );
		}

		if ( pasteInfo.format === 'redirects-file' ) {
			meta.push( {
				label: __( 'Contains', 'dsuite-redirects' ),
				value: __( 'Netlify/Cloudflare Pages redirect rules', 'dsuite-redirects' ),
			} );
		}

		return meta;
	};

	const getStats = (): CardStatItem[] => {
		if ( pasteText.trim().length === 0 || pasteInfo === null || ! pasteInfo.valid ) {
			return [];
		}

		if ( pasteInfo.format === 'json' ) {
			const stats: CardStatItem[] = [];

			if ( pasteInfo.contents?.groups !== undefined ) {
				stats.push( {
					label: _n( 'Group', 'Groups', pasteInfo.contents.groups || 0, 'dsuite-redirects' ),
					value: pasteInfo.contents.groups || 0,
				} );
			}

			if ( pasteInfo.contents?.redirects !== undefined ) {
				stats.push( {
					label: _n( 'Redirect', 'Redirects', pasteInfo.contents.redirects || 0, 'dsuite-redirects' ),
					value: pasteInfo.contents.redirects || 0,
				} );
			}

			if ( pasteInfo.contents?.logs !== undefined ) {
				stats.push( {
					label: _n( 'Log', 'Logs', pasteInfo.contents.logs || 0, 'dsuite-redirects' ),
					value: pasteInfo.contents.logs || 0,
				} );
			}

			if ( pasteInfo.contents?.errors_404 !== undefined ) {
				stats.push( {
					label: _n( '404 log', '404 logs', pasteInfo.contents.errors_404 || 0, 'dsuite-redirects' ),
					value: pasteInfo.contents.errors_404 || 0,
				} );
			}

			if ( pasteInfo.contents?.settings !== undefined ) {
				stats.push( {
					label: __( 'Settings', 'dsuite-redirects' ),
					value: pasteInfo.contents.settings || 0,
				} );
			}

			return stats;
		}

		if ( pasteInfo.format === 'apache' ) {
			return [
				{
					label: getApacheRuleLabel( pasteInfo, pasteInfo.rules || 0 ),
					value: pasteInfo.rules || 0,
				},
			];
		}

		if ( pasteInfo.format === 'redirects-file' ) {
			return [
				{
					label: getRedirectsFileRuleLabel( pasteInfo.rules || 0 ),
					value: pasteInfo.rules || 0,
				},
			];
		}

		if ( pasteInfo.format === 'csv' ) {
			return [
				{
					label: getCsvRowLabel( pasteInfo, pasteInfo.rows || 0 ),
					value: pasteInfo.rows || 0,
				},
			];
		}

		return [];
	};

	return (
		<IoCard
			title={ __( 'Copy/paste', 'dsuite-redirects' ) }
			badge={ __( 'Paste', 'dsuite-redirects' ) }
			meta={ getMeta() }
			stats={ getStats() }
			className={ clsx( 'import-source-card', 'import-source-card--paste', {
				'import-source-card--active': isActive,
			} ) }
			actions={
				pasteText.trim().length > 0 ? (
					<button
						type="button"
						className="button-secondary"
						onClick={ onClearPaste }
						disabled={ isImporting }
					>
						{ __( 'Clear pasted content', 'dsuite-redirects' ) }
					</button>
				) : undefined
			}
		>
			<div className="import-source-card__textarea-wrap">
				<textarea
					className="import-source-card__textarea"
					value={ pasteText }
					onChange={ ( event ) => onPasteTextChange( event.currentTarget.value ) }
					onFocus={ onSelect }
					placeholder={ __( 'Paste redirects or a Redirection export here', 'dsuite-redirects' ) }
					rows={ 8 }
					disabled={ isImporting }
				/>
			</div>
			{ pasteText.trim().length > 0 && pasteInfo !== null && ! pasteInfo.valid && (
				<div className="inline-notice inline-error">
					<p>{ getErrorMessage() }</p>
				</div>
			) }
		</IoCard>
	);
}

export default PasteImporter;
