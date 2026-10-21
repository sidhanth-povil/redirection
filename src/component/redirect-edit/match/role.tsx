import { __ } from '@wordpress/i18n';

import TableRow from '../table-row';

interface MatchRoleProps {
	data: {
		role?: string;
	};
	onChange: ( ev: React.ChangeEvent< HTMLInputElement > ) => void;
}

const MatchRole = ( { data, onChange }: MatchRoleProps ) => {
	const { role } = data;

	return (
		<TableRow title={ __( 'Role', 'dsuite-redirects' ) } className="redirect-edit__match">
			<input
				type="text"
				className="regular-text"
				value={ role }
				name="role"
				placeholder={ __( 'Enter role or capability value', 'dsuite-redirects' ) }
				onChange={ onChange }
			/>
		</TableRow>
	);
};

export default MatchRole;
