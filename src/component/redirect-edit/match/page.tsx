import { __ } from '@wordpress/i18n';

import TableRow from '../table-row';

const MatchPage = () => {
	return (
		<TableRow title={ __( 'Page Type', 'dsuite-redirects' ) } className="redirect-edit__match">
			<p>
				{ __( 'Only the 404 page type is currently supported.', 'dsuite-redirects' ) }&nbsp;
				{ __(
					'Please do not try and redirect all your 404s - this is not a good thing to do.',
					'dsuite-redirects'
				) }
			</p>
		</TableRow>
	);
};

export default MatchPage;
