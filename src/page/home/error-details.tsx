import { __ } from '@wordpress/i18n';
import { ExternalLink, createInterpolateElement } from '@wp-plugin-components';
import RestApiStatus from 'component/rest-api-status';
import { getErrorLinks } from 'lib/error-links';

function ErrorDetails() {
	return (
		<>
			<RestApiStatus />

			<h3>{ __( 'What do I do next?', 'dsuite-redirects' ) }</h3>

			<ol>
				<li>
					{ createInterpolateElement(
						__(
							'Take a look at the {{link}}plugin status{{/link}}. It may be able to identify and "magic fix" the problem.',
							'dsuite-redirects'
						),
						{
							// eslint-disable-next-line jsx-a11y/anchor-has-content
							link: <a href="?page=dsuite-redirects.php&sub=support" />,
						}
					) }
				</li>
				<li>
					{ createInterpolateElement(
						__(
							'{{link}}Caching software{{/link}}, in particular Cloudflare, can cache the wrong thing. Try clearing all your caches.',
							'dsuite-redirects'
						),
						{
							link: <ExternalLink url="https://redirection.me/support/problems/cloudflare/" />,
						}
					) }
				</li>
				<li>
					{ createInterpolateElement(
						__(
							'{{link}}Please temporarily disable other plugins!{{/link}} This fixes so many problems.',
							'dsuite-redirects'
						),
						{
							link: <ExternalLink url="https://redirection.me/support/problems/plugins/" />,
						}
					) }
				</li>
				<li>
					{ createInterpolateElement(
						__( 'Look at your {{link}}Site Health{{/link}} and resolve any issues.', 'dsuite-redirects' ),
						{
							link: <ExternalLink url={ getErrorLinks().siteHealth } />,
						}
					) }
				</li>
			</ol>
		</>
	);
}

export default ErrorDetails;
