import { __ } from '@wordpress/i18n';
import TableRow from './table-row';

interface RedirectTitleProps {
	title: string;
	onChange: ( changes: { title: string } ) => void;
}

function RedirectTitle( { title, onChange }: RedirectTitleProps ) {
	return (
		<TableRow title={ __( 'Title', 'dsuite-redirects' ) } className="redirect-edit__title">
			<input
				type="text"
				name="title"
				value={ title }
				onChange={ ( ev ) => onChange( { title: ev.target.value } ) }
				placeholder={ __( 'Describe the purpose of this redirect (optional)', 'dsuite-redirects' ) }
			/>
		</TableRow>
	);
}

export default RedirectTitle;
