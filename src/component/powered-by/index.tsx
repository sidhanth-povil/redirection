import { __ } from '@wordpress/i18n';
import { ExternalLink, createInterpolateElement } from '@wp-plugin-components';
import './style.scss';

const PoweredBy = () => (
	<div className="redirection-poweredby">
		{ createInterpolateElement( __( 'Powered by {{link}}redirect.li{{/link}}', 'dsuite-redirects' ), {
			link: <ExternalLink url="https://redirect.li" />,
		} ) }
	</div>
);

export default PoweredBy;
