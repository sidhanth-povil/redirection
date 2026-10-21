import { __, _n } from '@wordpress/i18n';
import clsx from 'clsx';
import IoCard, { type CardMetaItem, type CardStatItem } from 'component/import-export/card';
import type { ImportSniffResult } from './types';

type CsvFileInfo = Extract< ImportSniffResult, { format: 'csv' } >;
type ApacheFileInfo = Extract< ImportSniffResult, { format: 'apache' } >;

interface FileDropzoneProps {
	activeImportType: 'file' | 'paste' | 'plugin' | null;
	file: File | false;
	fileInfo: ImportSniffResult | null;
	fileInputRef: React.RefObject< HTMLInputElement >;
	hover: boolean;
	importingStatus: string;
	isImporting: boolean;
	isSniffing: boolean;
	onAddFileClick: () => void;
	onClearFile: () => void;
	onClick: () => void;
	onFileInputChange: ( event: React.ChangeEvent< HTMLInputElement > ) => void;
}

function FileDropzone( {
	activeImportType,
	file,
	fileInfo,
	fileInputRef,
	hover,
	importingStatus,
	isImporting,
	isSniffing,
	onAddFileClick,
	onClearFile,
	onClick,
	onFileInputChange,
}: FileDropzoneProps ) {
	const getFileErrorMessage = () => {
		if ( fileInfo?.error === 'not-redirection-json' ) {
			return __( 'Not a Redirection JSON export', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'invalid-json' ) {
			return __( 'Invalid JSON', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'empty-csv' ) {
			return __( 'Empty CSV file', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'separator-not-detected' ) {
			return __( 'Unable to detect a CSV separator', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'unknown-csv-layout' ) {
			return __( 'Unknown CSV layout', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'unknown-apache-layout' ) {
			return __( 'Unknown Apache .htaccess layout', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'unknown-redirects-file-layout' ) {
			return __(
				"This doesn't look like a valid _redirects file — check the from/to/status syntax on each line.",
				'dsuite-redirects'
			);
		}

		if ( fileInfo?.error === 'unsupported-file-type' ) {
			return __( 'Unsupported file type', 'dsuite-redirects' );
		}

		if ( fileInfo?.error === 'read-failed' ) {
			return __( 'Unable to read file', 'dsuite-redirects' );
		}

		return '';
	};

	const getSeparatorText = () => {
		if ( fileInfo?.format !== 'csv' || ! fileInfo.separator ) {
			return '';
		}

		if ( fileInfo.separator === ',' ) {
			return __( 'Comma', 'dsuite-redirects' );
		}

		if ( fileInfo.separator === ';' ) {
			return __( 'Semicolon', 'dsuite-redirects' );
		}

		if ( fileInfo.separator === '|' ) {
			return __( 'Pipe', 'dsuite-redirects' );
		}

		return __( 'Tab', 'dsuite-redirects' );
	};

	const getFileSize = () => {
		if ( file === false ) {
			return '';
		}

		if ( file.size < 1024 ) {
			return `${ file.size } B`;
		}

		if ( file.size < 1024 * 1024 ) {
			return `${ ( file.size / 1024 ).toFixed( 1 ) } KB`;
		}

		return `${ ( file.size / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
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

	const renderSelectedFileCard = () => {
		if ( file === false ) {
			return null;
		}

		if ( isSniffing ) {
			return <p>{ __( 'Inspecting file…', 'dsuite-redirects' ) }</p>;
		}

		if ( fileInfo === null ) {
			return null;
		}

		if ( ! fileInfo.valid ) {
			return (
				<div className="inline-notice inline-error">
					<p>{ getFileErrorMessage() }</p>
				</div>
			);
		}

		const details: CardMetaItem[] = [
			{
				label: __( 'Details', 'dsuite-redirects' ),
				value: getFileSize(),
			},
		];
		const stats: CardStatItem[] = [];
		let importNote = '';
		let type = '';

		if ( fileInfo.format === 'json' ) {
			type = __( 'JSON', 'dsuite-redirects' );
			if ( fileInfo.version ) {
				details.push( {
					label: __( 'Plugin version', 'dsuite-redirects' ),
					value: fileInfo.version,
				} );
			}
			if ( fileInfo.contents?.groups !== undefined ) {
				stats.push( {
					label: _n( 'Group', 'Groups', fileInfo.contents.groups || 0, 'dsuite-redirects' ),
					value: fileInfo.contents.groups || 0,
				} );
			}
			if ( fileInfo.contents?.redirects !== undefined ) {
				stats.push( {
					label: _n( 'Redirect', 'Redirects', fileInfo.contents.redirects || 0, 'dsuite-redirects' ),
					value: fileInfo.contents.redirects || 0,
				} );
			}
			if ( fileInfo.contents?.logs !== undefined ) {
				stats.push( {
					label: _n( 'Log', 'Logs', fileInfo.contents.logs || 0, 'dsuite-redirects' ),
					value: fileInfo.contents.logs || 0,
				} );
			}
			if ( fileInfo.contents?.errors_404 !== undefined ) {
				stats.push( {
					label: _n( '404 log', '404 logs', fileInfo.contents.errors_404 || 0, 'dsuite-redirects' ),
					value: fileInfo.contents.errors_404 || 0,
				} );
			}
			if ( fileInfo.contents?.settings !== undefined ) {
				stats.push( {
					label: __( 'Settings', 'dsuite-redirects' ),
					value: fileInfo.contents.settings || 0,
				} );
			}
		}

		if ( fileInfo.format === 'csv' ) {
			type = __( 'CSV', 'dsuite-redirects' );

			if ( fileInfo.type === 'redirects' ) {
				importNote = __( 'This redirect CSV can be imported.', 'dsuite-redirects' );
			} else if ( fileInfo.type === 'groups' ) {
				importNote = __(
					'Group CSV exports can be viewed, but group import is only supported with JSON.',
					'dsuite-redirects'
				);
			} else if ( fileInfo.type === 'logs' ) {
				importNote = __(
					'Redirect log CSV exports can be viewed, but log import is only supported with JSON.',
					'dsuite-redirects'
				);
			} else if ( fileInfo.type === 'errors_404' ) {
				importNote = __(
					'404 log CSV exports can be viewed, but 404 log import is only supported with JSON.',
					'dsuite-redirects'
				);
			}

			if ( fileInfo.type === 'redirects' ) {
				details.push( {
					label: __( 'Contains', 'dsuite-redirects' ),
					value: __( 'Redirects', 'dsuite-redirects' ),
				} );
			}

			if ( fileInfo.type === 'groups' ) {
				details.push( {
					label: __( 'Contains', 'dsuite-redirects' ),
					value: __( 'Groups', 'dsuite-redirects' ),
				} );
			}

			if ( fileInfo.type === 'logs' ) {
				details.push( {
					label: __( 'Contains', 'dsuite-redirects' ),
					value: __( 'Redirect logs', 'dsuite-redirects' ),
				} );
			}

			if ( fileInfo.type === 'errors_404' ) {
				details.push( {
					label: __( 'Contains', 'dsuite-redirects' ),
					value: __( '404 logs', 'dsuite-redirects' ),
				} );
			}

			details.push( {
				label: __( 'Separator', 'dsuite-redirects' ),
				value: getSeparatorText(),
			} );
			stats.push( {
				label: getCsvRowLabel( fileInfo, fileInfo.rows || 0 ),
				value: fileInfo.rows || 0,
			} );
		}

		if ( fileInfo.format === 'apache' ) {
			type = __( 'Apache .htaccess', 'dsuite-redirects' );
			importNote = __( 'This Apache .htaccess content can be imported.', 'dsuite-redirects' );
			details.push( {
				label: __( 'Contains', 'dsuite-redirects' ),
				value: __( 'Apache redirect rules', 'dsuite-redirects' ),
			} );
			stats.push( {
				label: getApacheRuleLabel( fileInfo, fileInfo.rules || 0 ),
				value: fileInfo.rules || 0,
			} );
		}

		if ( fileInfo.format === 'redirects-file' ) {
			type = __( '_redirects', 'dsuite-redirects' );
			importNote = __( 'This _redirects file can be imported.', 'dsuite-redirects' );
			details.push( {
				label: __( 'Contains', 'dsuite-redirects' ),
				value: __( 'Netlify/Cloudflare Pages redirect rules', 'dsuite-redirects' ),
			} );
			stats.push( {
				label: getRedirectsFileRuleLabel( fileInfo.rules || 0 ),
				value: fileInfo.rules || 0,
			} );
		}

		return (
			<IoCard
				title={ file.name }
				badge={ __( 'File', 'dsuite-redirects' ) }
				meta={ [
					{
						label: __( 'Import type', 'dsuite-redirects' ),
						value: type,
						description: importNote || undefined,
					},
					...details,
				] }
				stats={ stats }
				wrapped={ false }
			/>
		);
	};

	const renderInitialDrop = () => {
		return (
			<IoCard
				title={ __( 'Import file', 'dsuite-redirects' ) }
				badge={ __( 'File', 'dsuite-redirects' ) }
				meta={ [
					{
						label: __( 'Import type', 'dsuite-redirects' ),
						value: __( 'Upload a file', 'dsuite-redirects' ),
					},
					{
						label: __( 'Supported formats', 'dsuite-redirects' ),
						value: __( 'CSV, JSON, .htaccess, and _redirects', 'dsuite-redirects' ),
					},
				] }
				children={
					<div className="file-sniff__meta-description">
						{ __( 'Drag and drop a file anywhere on this page.', 'dsuite-redirects' ) }
					</div>
				}
				actions={
					<button type="button" className="button-secondary" onClick={ onAddFileClick }>
						{ __( 'Add file', 'dsuite-redirects' ) }
					</button>
				}
				wrapped={ false }
			/>
		);
	};

	const classes = clsx( 'dropzone', 'import-source-card', {
		'dropzone-dropped': file !== false,
		'dropzone-importing': importingStatus === 'loading',
		'dropzone-hover': hover,
		'import-source-card--active': activeImportType === 'file' && file !== false,
	} );
	const isSelectable = activeImportType !== 'file' && file !== false;
	const onCardKeyDown = ( event: React.KeyboardEvent< HTMLDivElement > ) => {
		if ( ! isSelectable ) {
			return;
		}

		if ( event.key === 'Enter' || event.key === ' ' ) {
			event.preventDefault();
			onClick();
		}
	};

	return (
		<div
			className={ classes }
			onClick={ isSelectable ? onClick : undefined }
			onKeyDown={ isSelectable ? onCardKeyDown : undefined }
			role={ isSelectable ? 'button' : undefined }
			tabIndex={ isSelectable ? 0 : undefined }
		>
			<input
				ref={ fileInputRef }
				type="file"
				style={ { display: 'none' } }
				onChange={ onFileInputChange }
				// No `accept` filter: the HTML attribute only matches MIME types and
				// dot-prefixed extensions, so it can't target an extensionless file
				// like `_redirects` without also hiding it from the OS picker.
				// Format detection instead happens after selection, via sniffImportFile.
			/>
			{ file === false ? (
				renderInitialDrop()
			) : (
				<div className="dropzone-selected">
					{ renderSelectedFileCard() }
					<div className="import-source-card__actions">
						<button
							type="button"
							className="button-secondary"
							onClick={ onClearFile }
							disabled={ isImporting }
						>
							{ __( 'Clear file', 'dsuite-redirects' ) }
						</button>
					</div>
				</div>
			) }
		</div>
	);
}

export default FileDropzone;
