import { __ } from '@wordpress/i18n';
import { Select } from '@wp-plugin-components';
import type { SelectOption } from '@wp-plugin-components/select';
import type { DuplicateMode } from 'lib/api/hooks';
import { nestedGroups } from 'lib/wordpress-url';
import type { ImportSniffResult } from './types';

interface GroupRow {
	id: number;
	[ key: string ]: unknown;
}

interface ImportOptionsProps {
	activeImportType: 'file' | 'paste' | 'plugin' | null;
	activePluginId: string | null;
	file: File | false;
	disabled?: boolean;
	deleteSource: boolean;
	duplicateMode: DuplicateMode;
	group: number;
	groupRows: GroupRow[];
	fileInfo: ImportSniffResult | null;
	isJsonFile: ( file: File ) => boolean;
	selectedSections: string[];
	onChange: ( event: React.ChangeEvent< HTMLSelectElement | HTMLInputElement > ) => void;
}

function ImportOptions( {
	activeImportType,
	activePluginId,
	file,
	disabled = false,
	deleteSource,
	duplicateMode,
	group,
	groupRows,
	fileInfo,
	isJsonFile,
	selectedSections,
	onChange,
}: ImportOptionsProps ) {
	const items = nestedGroups( groupRows as any ) as unknown as SelectOption[];
	const showDeleteSource =
		activeImportType === 'plugin' &&
		( activePluginId === 'wordpress-old-slugs' || activePluginId === 'safe-redirect-manager' );
	const isFileImport = activeImportType === 'file' || activeImportType === 'paste';
	const groupItems =
		isFileImport && file && isJsonFile( file )
			? [ { value: '0', label: __( 'Use groups in file', 'dsuite-redirects' ) }, ...items ]
			: items;
	const jsonSections =
		isFileImport && fileInfo?.format === 'json' && fileInfo.valid && fileInfo.contents ? fileInfo.contents : null;
	const hasRedirectCsv =
		isFileImport && fileInfo?.format === 'csv' && fileInfo.valid && fileInfo.importSupported === true;
	const hasApacheImport = isFileImport && fileInfo?.format === 'apache' && fileInfo.valid;
	const hasRedirectsFileImport = isFileImport && fileInfo?.format === 'redirects-file' && fileInfo.valid;
	const hasRedirectSection = jsonSections
		? Number( jsonSections.redirects || 0 ) > 0 && selectedSections.includes( 'redirects' )
		: activeImportType === 'plugin' || hasRedirectCsv || hasApacheImport || hasRedirectsFileImport;
	const hasOptions = jsonSections !== null || hasRedirectSection || showDeleteSource;

	return (
		<fieldset className="groups inline-edit-row" disabled={ disabled }>
			<h3>{ __( 'Import options', 'dsuite-redirects' ) }</h3>
			{ ! hasOptions && <p>{ __( 'Select an import source to see available options.', 'dsuite-redirects' ) }</p> }
			{ jsonSections && (
				<div className="groups__row">
					<div className="groups__label">{ __( 'Contents', 'dsuite-redirects' ) }</div>
					<div className="groups__control groups__control--stacked">
						{ Object.entries( jsonSections ).map( ( [ section, total ] ) => (
							<label
								className="groups__checkbox"
								htmlFor={ `import_section_${ section }` }
								key={ section }
							>
								<input
									id={ `import_section_${ section }` }
									type="checkbox"
									name={ `import_section_${ section }` }
									checked={ selectedSections.includes( section ) }
									onChange={ onChange }
									disabled={ disabled }
								/>{ ' ' }
								<span>
									{ section === 'settings' && __( 'Settings', 'dsuite-redirects' ) }
									{ section === 'groups' && __( 'Groups', 'dsuite-redirects' ) }
									{ section === 'redirects' && __( 'Redirects', 'dsuite-redirects' ) }
									{ section === 'logs' && __( 'Redirect logs', 'dsuite-redirects' ) }
									{ section === 'errors_404' && __( '404 logs', 'dsuite-redirects' ) } ({ total })
								</span>
							</label>
						) ) }
					</div>
				</div>
			) }
			{ hasRedirectSection && (
				<>
					<div className="groups__row">
						<div className="groups__label">{ __( 'Group', 'dsuite-redirects' ) }</div>
						<div className="groups__control">
							<Select
								items={ groupItems as any }
								name="group"
								value={ String( group ) }
								onChange={ onChange as any }
								disabled={ disabled }
							/>
						</div>
					</div>
					<div className="groups__row">
						<div className="groups__label">{ __( 'Duplicates', 'dsuite-redirects' ) }</div>
						<div className="groups__control">
							<Select
								items={ [
									{ value: 'import', label: __( 'Do not check duplicates', 'dsuite-redirects' ) },
									{ value: 'ignore', label: __( 'Ignore duplicates', 'dsuite-redirects' ) },
									{ value: 'update', label: __( 'Update duplicates', 'dsuite-redirects' ) },
								] }
								name="duplicate_mode"
								value={ duplicateMode }
								onChange={ onChange as any }
								disabled={ disabled }
							/>
						</div>
					</div>
				</>
			) }
			{ showDeleteSource && (
				<div className="groups__row">
					<div className="groups__label">{ __( 'Delete original data', 'dsuite-redirects' ) }</div>
					<div className="groups__control">
						<label className="groups__checkbox" htmlFor="delete_source">
							<input
								id="delete_source"
								type="checkbox"
								name="delete_source"
								checked={ deleteSource }
								onChange={ onChange }
								disabled={ disabled }
							/>{ ' ' }
							<span>{ __( 'Remove the original redirect data after import', 'dsuite-redirects' ) }</span>
						</label>
					</div>
				</div>
			) }
		</fieldset>
	);
}

export default ImportOptions;
