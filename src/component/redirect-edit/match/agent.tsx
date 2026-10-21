import { useState } from 'react';
import { __ } from '@wordpress/i18n';

import { ExternalLink } from '@wp-plugin-components';
import TableRow from '../table-row';

interface MatchAgentProps {
	onChange: ( event: React.ChangeEvent< HTMLInputElement | HTMLSelectElement > ) => void;
	data: {
		agent: string;
		regex: boolean;
	};
}

function MatchAgent( { onChange, data }: MatchAgentProps ) {
	const [ dropdown, setDropdown ] = useState( '' );
	const { agent, regex } = data;

	const onDropdown = ( ev: React.ChangeEvent< HTMLSelectElement > ) => {
		const regexPatterns: Record< string, string > = {
			mobile: 'iPad|iPod|iPhone|Android|BlackBerry|SymbianOS|SCH-Md+|Opera Mini|Windows CE|Nokia|SonyEricsson|webOS|PalmOS',
			feed: 'Bloglines|feed|rss',
			lib: 'cURL|Java|libwww-perl|PHP|urllib',
		};

		if ( ev.target.value !== '' ) {
			onChange( {
				target: { name: 'agent', value: regexPatterns[ ev.target.value ] },
			} as React.ChangeEvent< HTMLInputElement > );
		}

		setDropdown( '' );
	};

	return (
		<TableRow title={ __( 'User Agent', 'dsuite-redirects' ) } className="redirect-edit__match">
			<input
				type="text"
				name="agent"
				value={ agent }
				onChange={ onChange }
				className="regular-text"
				placeholder={ __( 'Match against this browser user agent', 'dsuite-redirects' ) }
			/>

			<select name="agent_dropdown" onChange={ onDropdown } value={ dropdown } className="medium">
				<option value="">{ __( 'Custom', 'dsuite-redirects' ) }</option>
				<option value="mobile">{ __( 'Mobile', 'dsuite-redirects' ) }</option>
				<option value="feed">{ __( 'Feed Readers', 'dsuite-redirects' ) } </option>
				<option value="lib">{ __( 'Libraries', 'dsuite-redirects' ) }</option>
			</select>

			<input id="redirect-agent-regex" type="checkbox" name="regex" checked={ regex } onChange={ onChange } />
			<label className="redirect-edit-regex" htmlFor="redirect-agent-regex">
				{ __( 'Regex', 'dsuite-redirects' ) }{ ' ' }
				<sup>
					<ExternalLink url="https://redirection.me/support/redirect-regular-expressions/">?</ExternalLink>
				</sup>
			</label>
		</TableRow>
	);
}

export default MatchAgent;
