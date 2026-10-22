import { __ } from '@wordpress/i18n';

function DebugReport() {
	return (
		<p className="wpl-error__highlight">
			{ __(
				'Send these details to your site developer, along with a description of what you were doing and a screenshot.',
				'dsuite-redirects'
			) }
		</p>
	);
}

export default DebugReport;
