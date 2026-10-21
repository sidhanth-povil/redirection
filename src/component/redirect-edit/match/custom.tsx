import { __ } from '@wordpress/i18n';

import TableRow from '../table-row';

interface MatchCustomProps {
	data: {
		filter?: string;
	};
	onChange: ( ev: React.ChangeEvent< HTMLInputElement > ) => void;
}

const MatchCustom = ( { data, onChange }: MatchCustomProps ) => {
	const { filter } = data;

	return (
		<TableRow title={ __( 'Filter Name', 'dsuite-redirects' ) } className="redirect-edit__match">
			<input
				type="text"
				name="filter"
				value={ filter }
				onChange={ onChange }
				className="regular-text"
				placeholder={ __( 'WordPress filter name', 'dsuite-redirects' ) }
			/>
		</TableRow>
	);
};

export default MatchCustom;
