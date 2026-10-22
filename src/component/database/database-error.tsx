import { __ } from '@wordpress/i18n';
import TextareaAutosize from 'react-textarea-autosize';
import { useDatabaseUpgrade } from 'lib/api/hooks/use-settings';
import { useSettingsStore } from 'stores';

interface DatabaseErrorProps {
	onRetry: () => void;
	error: string;
}

function getErrorMessage( reason: string, current: string, next: string, debug: string[] ): string {
	const message = [
		reason ? 'Message: ' + reason : null,
		'Installed: ' + current,
		'Next: ' + next,
		debug.length > 0 ? 'Debug: ' + debug.join( '\n' ) : null,
	];

	return message.filter( ( item ) => item ).join( '\n' );
}

export default function DatabaseError( { onRetry, error }: DatabaseErrorProps ) {
	const { current, next, debug, reason } = useSettingsStore( ( state ) => state.database );
	const { mutate: upgradeDatabaseMutation } = useDatabaseUpgrade();
	const recovery = getErrorMessage( reason, current, next, debug );
	function onSkip() {
		upgradeDatabaseMutation( 'skip' );
	}

	function onStop() {
		upgradeDatabaseMutation( 'stop' );
	}

	return (
		<div className="redirection-database_error wpl-error">
			<h3>{ __( 'Database problem', 'dsuite-redirects' ) }</h3>
			<p>{ error }</p>
			<p>
				<button className="button button-primary" onClick={ onRetry }>
					{ __( 'Try again', 'dsuite-redirects' ) }
				</button>
				&nbsp;
				{ current !== '-' && (
					<button className="button button-secondary" onClick={ onSkip }>
						{ __( 'Skip this stage', 'dsuite-redirects' ) }
					</button>
				) }
				&nbsp;
				{ current !== '-' && (
					<button className="button button-secondary" onClick={ onStop }>
						{ __( 'Stop upgrade', 'dsuite-redirects' ) }
					</button>
				) }
			</p>

			<p>{ __( 'If you need help, send these details to your site developer:', 'dsuite-redirects' ) }</p>

			<TextareaAutosize readOnly value={ recovery } rows={ 15 } />
		</div>
	);
}
