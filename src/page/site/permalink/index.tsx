import { __ } from '@wordpress/i18n';
import Permalink from './permalink';

const PERMALINK_MAX = 10;

interface PermalinkSettingsProps {
	permalinks: string[];
	onChange: ( value: { permalinks: string[] } ) => void;
}

const addPermalink = (
	permalinks: string[],
	onChange: ( value: { permalinks: string[] } ) => void,
	ev: React.MouseEvent< HTMLButtonElement >
) => {
	ev.preventDefault();

	onChange( { permalinks: permalinks.concat( '' ).slice( 0, PERMALINK_MAX ) } );
};

const removePermalink = (
	pos: number,
	permalinks: string[],
	onChange: ( value: { permalinks: string[] } ) => void
) => {
	onChange( { permalinks: [ ...permalinks.slice( 0, pos ), ...permalinks.slice( pos + 1 ) ] } );
};

const updatePermalink = (
	pos: number,
	permalinks: string[],
	onChange: ( value: { permalinks: string[] } ) => void,
	ev: React.ChangeEvent< HTMLInputElement >
) => {
	const updated = permalinks.slice();

	updated[ pos ] = ev.target.value;

	onChange( { permalinks: updated } );
};

function PermalinkSettings( props: PermalinkSettingsProps ) {
	const { permalinks, onChange } = props;

	return (
		<>
			<h3>{ __( 'Permalink Migration', 'dsuite-redirects' ) }</h3>
			<p>
				{ __(
					'Enter old permalinks structures to automatically migrate them to your current one.',
					'dsuite-redirects'
				) }
			</p>
			<p>
				{ __(
					'Note: this is in beta and will only migrate posts. Certain permalinks will not work. If yours does not work then you will need to wait until it is out of beta.',
					'dsuite-redirects'
				) }
			</p>

			<table className="wp-list-table widefat fixed striped items redirect-aliases table-auto inline-edit-row">
				<thead>
					<tr>
						<th>{ __( 'Permalinks', 'dsuite-redirects' ) }</th>
						<th className="redirect-alias__delete" />
					</tr>
				</thead>

				<tbody>
					{ permalinks.map( ( link, key ) => (
						<Permalink
							key={ key }
							link={ link }
							onChange={ ( ev ) => updatePermalink( key, permalinks, onChange, ev ) }
							onDelete={ () => removePermalink( key, permalinks, onChange ) }
						/>
					) ) }
					{ permalinks.length === 0 && (
						<tr>
							<td colSpan={ 2 }>{ __( 'No migrated permalinks', 'dsuite-redirects' ) }</td>
						</tr>
					) }
				</tbody>
			</table>

			<p>
				<button className="button-secondary" onClick={ ( ev ) => addPermalink( permalinks, onChange, ev ) }>
					{ __( 'Add Permalink', 'dsuite-redirects' ) }
				</button>
			</p>
		</>
	);
}

export default PermalinkSettings;
