import { __ } from '@wordpress/i18n';
import { Error, Button } from '@wp-plugin-components';
import { getErrorLinks, getErrorDetails, getCacheBuster, getReloadUrl } from 'lib/error-links';

function reloadWithoutCache() {
	window.location.href = getReloadUrl();
}

function CacheDetect() {
	return (
		<Error
			errors={ '' }
			details={ getErrorDetails().concat( [ getCacheBuster() ] ) }
			type="fixed"
			title={ __( 'Cached DSuite Redirects detected', 'dsuite-redirects' ) }
			links={ getErrorLinks() }
			locale="redirection"
		>
			<p>
				{ __(
					'This page was loaded from an old cached copy of the WordPress admin area. This is usually caused by a caching system, such as Cloudflare, LiteSpeed, or your host, rather than by your own browser.',
					'dsuite-redirects'
				) }
			</p>
			<p>
				<Button isPrimary onClick={ reloadWithoutCache }>
					{ __( 'Reload without cache', 'dsuite-redirects' ) }
				</Button>
			</p>
			<p>
				{ __(
					'If reloading does not fix this, ask your host or caching provider to exclude the WordPress admin area (/wp-admin/) from any page caching, then clear the cache.',
					'dsuite-redirects'
				) }
			</p>
		</Error>
	);
}

export default CacheDetect;
