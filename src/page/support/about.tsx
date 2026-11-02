import { __, sprintf } from '@wordpress/i18n';

const SITE_URL = 'https://designsuite.ai';

export default function About() {
	return (
		<>
			<h3>{ __( 'About DSuite Redirects', 'dsuite-redirects' ) }</h3>
			<p>
				{ __( 'DSuite Redirects is built and looked after by', 'dsuite-redirects' ) }{ ' ' }
				<a href={ SITE_URL } target="_blank" rel="noopener noreferrer">
					Designsuite.ai
					<span className="screen-reader-text">{ __( '(opens in a new tab)', 'dsuite-redirects' ) }</span>
				</a>
				.{ ' ' }
				{ __(
					'We made it for the websites we design and run, so marketing teams can manage redirects, schedule campaign links and fix 404s without a developer. Everything stays on your site: no outside services.',
					'dsuite-redirects'
				) }
			</p>
			<p>
				{
					/* translators: %s: plugin version number */
					sprintf( __( 'Version %s', 'dsuite-redirects' ), window.Redirectioni10n?.version ?? '' )
				}
				{ ' · ' }
				{ __( 'Based on Redirection by John Godley, under the GPL.', 'dsuite-redirects' ) }
			</p>
		</>
	);
}
