import { __, _n } from '@wordpress/i18n';
import clsx from 'clsx';
import IoCard from './card';

interface Plugin {
	id: string;
	name: string;
	description: string;
	source: string;
	preview_supported?: boolean;
	total: number;
}

interface ImporterProps {
	plugin: Plugin;
	onSelect: ( plugin: Plugin ) => void;
	isActive?: boolean;
	isImporting?: boolean;
}

function Importer( props: ImporterProps ) {
	const { plugin, onSelect, isActive = false, isImporting = false } = props;
	const { name, description, source, total } = plugin;
	const clicker = () => {
		onSelect( plugin );
	};

	return (
		<IoCard
			title={ name }
			badge={ __( 'Plugin', 'dsuite-redirects' ) }
			meta={ [
				{
					label: __( 'Import type', 'dsuite-redirects' ),
					value: description,
				},
				{
					label: __( 'Stored in', 'dsuite-redirects' ),
					value: source,
				},
			] }
			stats={ [
				{
					label: _n( 'Redirect', 'Redirects', total, 'dsuite-redirects' ),
					value: total,
				},
			] }
			actions={
				<button type="button" onClick={ clicker } className="button-secondary" disabled={ isImporting }>
					{ isActive ? __( 'Clear importer', 'dsuite-redirects' ) : __( 'Use importer', 'dsuite-redirects' ) }
				</button>
			}
			className={ clsx( 'import-source-card', 'import-source-card--plugin', {
				'import-source-card--active': isActive,
			} ) }
		/>
	);
}

export default Importer;
