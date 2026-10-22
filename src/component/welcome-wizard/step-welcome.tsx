import { __, sprintf } from '@wordpress/i18n';
import { createInterpolateElement } from '@wp-plugin-components';
import { STEP_DATABASE, STEP_BASIC } from './constants';

interface StepWelcomeProps {
	setStep: ( step: number ) => void;
	setOptions: ( options: any ) => void;
}

export default function StepWelcome( { setStep, setOptions }: StepWelcomeProps ) {
	function startAutomatic() {
		setOptions( { manual: false } );
		setStep( STEP_BASIC );
	}

	function startManual() {
		setOptions( { manual: true } );
		setStep( STEP_DATABASE );
	}

	return (
		<>
			<h2>{ __( 'Welcome to DSuite Redirects 🚀🎉', 'dsuite-redirects' ) }</h2>

			<p>
				{ sprintf(
					// translators: %(version)s is the plugin version number
					__(
						'Thank you for installing and using DSuite Redirects v%(version)s. This plugin will allow you to manage 301 redirections, keep track of 404 errors, and improve your site, with no knowledge of Apache or Nginx needed.',
						'dsuite-redirects'
					),
					{
						version: window.Redirectioni10n.version,
					}
				) }
			</p>
			<p>
				{ __(
					'DSuite Redirects is designed to be used on sites with a few redirects to sites with thousands of redirects.',
					'dsuite-redirects'
				) }
			</p>

			<h3>{ __( 'How do I use this plugin?', 'dsuite-redirects' ) }</h3>
			<p>
				{ createInterpolateElement(
					__(
						"A simple redirect involves setting a {{strong}}source URL{{/strong}} (the old URL) and a {{strong}}target URL{{/strong}} (the new URL). Here's an example:",
						'dsuite-redirects'
					),
					{
						strong: <strong />,
					}
				) }
			</p>

			<table className="redirect-edit">
				<tbody>
					<tr>
						<th>{ __( 'Source URL', 'dsuite-redirects' ) }:</th>
						<td>
							<input
								type="text"
								className="regular-text"
								readOnly
								value={ __(
									'(Example) The source URL is your old or original URL',
									'dsuite-redirects'
								) }
							/>
						</td>
					</tr>
					<tr>
						<th>{ __( 'Target URL', 'dsuite-redirects' ) }:</th>
						<td>
							<input
								type="text"
								className="regular-text"
								readOnly
								value={ __( '(Example) The target URL is the new URL', 'dsuite-redirects' ) }
							/>
						</td>
					</tr>
				</tbody>
			</table>

			<p>
				{ __(
					"That's all there is to it - you are now redirecting! Note that the above is just an example.",
					'dsuite-redirects'
				) }
			</p>

			<h3>{ __( 'Some features you may find useful are', 'dsuite-redirects' ) }:</h3>

			<ul>
				<li>
					{ __(
						'Monitor 404 errors, get detailed information about the visitor, and fix any problems',
						'dsuite-redirects'
					) }
				</li>
				<li>{ __( 'Import from .htaccess, CSV, and a variety of other plugins', 'dsuite-redirects' ) }</li>
				<li>
					{ __(
						'More powerful URL matching, including regular expressions, and other conditions',
						'dsuite-redirects'
					) }
				</li>
				<li>{ __( 'Check a URL is being redirected', 'dsuite-redirects' ) }</li>
			</ul>

			<h3>{ __( "What's next?", 'dsuite-redirects' ) }</h3>
			<p>
				{ __(
					'First you will be asked a few questions, and then DSuite Redirects will set up your database.',
					'dsuite-redirects'
				) }
			</p>

			<div className="wizard-buttons">
				<button className="button-primary button" onClick={ startAutomatic }>
					{ __( 'Start Setup', 'dsuite-redirects' ) }
				</button>{ ' ' }
				<button className="button-secondary button" onClick={ startManual }>
					{ __( 'Manual Setup', 'dsuite-redirects' ) }
				</button>
			</div>
		</>
	);
}
