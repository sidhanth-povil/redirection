import { __ } from '@wordpress/i18n';

import TableRow from '../table-row';

interface MatchReferrerProps {
	data: {
		referrer?: string;
		regex?: boolean;
	};
	onChange: ( ev: React.ChangeEvent< HTMLInputElement > ) => void;
}

const MatchReferrer = ( { data, onChange }: MatchReferrerProps ) => {
	const { referrer, regex } = data;

	return (
		<TableRow title={ __( 'Referrer', 'dsuite-redirects' ) } className="redirect-edit__match">
			<input
				type="text"
				className="regular-text"
				name="referrer"
				value={ referrer }
				onChange={ onChange }
				placeholder={ __( 'Match against this browser referrer text', 'dsuite-redirects' ) }
			/>

			<input id="redirect-referrer-regex" type="checkbox" name="regex" checked={ regex } onChange={ onChange } />
			<label className="redirect-edit-regex" htmlFor="redirect-referrer-regex">
				{ __( 'Regex', 'dsuite-redirects' ) }
			</label>
		</TableRow>
	);
};

export default MatchReferrer;
