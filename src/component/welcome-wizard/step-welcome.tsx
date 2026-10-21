import { __, sprintf } from '@wordpress/i18n';
import { ExternalLink, createInterpolateElement } from '@wp-plugin-components';
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
			<h2>{ __( 'Welcome to Redirection 🚀🎉', 'dsuite-redirects' ) }</h2>

			<p>
				{ sprintf(
					// translators: %(version)s is the plugin version number
					__(
						'Thank you for installing and using Redirection v%(version)s. This plugin will allow you to manage 301 redirections, keep track of 404 errors, and improve your site, with no knowledge of Apache or Nginx needed.',
						'dsuite-redirects'
					),
					{
						version: window.Redirectioni10n.version,
					}
				) }
			</p>
			<p>
				{ __(
					'Redirection is designed to be used on sites with a few redirects to sites with thousands of redirects.',
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
			<p>
				{ createInterpolateElement(
					__(
						'Full documentation can be found on the {{link}}Redirection website.{{/link}}',
						'dsuite-redirects'
					),
					{
						link: <ExternalLink url="https://redirection.me/support/" />,
					}
				) }
			</p>

			<h3>{ __( 'Some features you may find useful are', 'dsuite-redirects' ) }:</h3>

			<ul>
				<li>
					{ createInterpolateElement(
						__(
							'{{link}}Monitor 404 errors{{/link}}, get detailed information about the visitor, and fix any problems',
							'dsuite-redirects'
						),
						{
							link: <ExternalLink url="https://redirection.me/support/tracking-404-errors/" />,
						}
					) }
				</li>
				<li>
					{ createInterpolateElement(
						__(
							'{{link}}Import{{/link}} from .htaccess, CSV, and a variety of other plugins',
							'dsuite-redirects'
						),
						{
							link: <ExternalLink url="https://redirection.me/support/import-export-redirects/" />,
						}
					) }
				</li>
				<li>
					{ createInterpolateElement(
						__(
							'More powerful URL matching, including {{regular}}regular expressions{{/regular}}, and {{other}}other conditions{{/other}}',
							'dsuite-redirects'
						),
						{
							regular: (
								<ExternalLink url="https://redirection.me/support/redirect-regular-expressions/" />
							),
							other: <ExternalLink url="https://redirection.me/support/matching-redirects/" />,
						}
					) }
				</li>
				<li>{ __( 'Check a URL is being redirected', 'dsuite-redirects' ) }</li>
			</ul>

			<h3>{ __( "What's next?", 'dsuite-redirects' ) }</h3>
			<p>
				{ __(
					'First you will be asked a few questions, and then Redirection will set up your database.',
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
