import { sprintf, __ } from '@wordpress/i18n';
import { Notice, Button } from '@wp-plugin-components';
import { has_capability, CAP_OPTION_MANAGE } from 'lib/capabilities';
import { useSettingsUpdate } from 'lib/api/hooks/use-settings';

function UpdateNotice() {
	const { update_notice = false } = window.Redirectioni10n;
	const { mutate: updateSettings } = useSettingsUpdate();

	function dismiss() {
		updateSettings( { update_notice: window.Redirectioni10n.update_notice as any } );
		( window.Redirectioni10n as any ).update_notice = false;
	}

	if ( ! update_notice || ! has_capability( CAP_OPTION_MANAGE ) ) {
		return null;
	}

	return (
		<Notice className="update-notice">
			<p>
				{ sprintf(
					// translators: %s is the version number
					__( 'Version %s installed!', 'dsuite-redirects' ),
					update_notice
				) }
				&nbsp;
				<Button onClick={ dismiss }>{ __( 'OK', 'dsuite-redirects' ) }</Button>
			</p>
		</Notice>
	);
}

export default UpdateNotice;
