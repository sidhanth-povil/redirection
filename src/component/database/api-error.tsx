import { __ } from '@wordpress/i18n';

interface DatabaseApiErrorProps {
	error?: string;
	onRetry: () => void;
}

export default function DatabaseApiError( { onRetry }: DatabaseApiErrorProps ) {
	return (
		<div className="redirection-database_error wpl-error">
			<h3>{ __( 'Database problem', 'dsuite-redirects' ) }</h3>

			<p>
				<button className="button button-primary" onClick={ onRetry }>
					{ __( 'Try again', 'dsuite-redirects' ) }
				</button>
			</p>
		</div>
	);
}
