import { __ } from '@wordpress/i18n';
import RestApiStatus from 'component/rest-api-status';
import PluginStatus from './plugin-status';
import Debug from './debug';
import { useSettingsStore } from 'stores';
import { usePluginStatus } from 'lib/api/hooks/use-settings';

function Status() {
	// Direct property access instead of destructuring
	const status = useSettingsStore( ( state ) => state.pluginStatus.status );
	const debug = useSettingsStore( ( state ) => state.pluginStatus.debug );

	usePluginStatus();

	return (
		<>
			<h2>{ __( 'WordPress REST API', 'dsuite-redirects' ) }</h2>
			<p>
				{ __(
					'DSuite Redirects communicates with WordPress through the WordPress REST API. This is a standard part of WordPress, and you will experience problems if you cannot use it.',
					'dsuite-redirects'
				) }
			</p>
			<RestApiStatus />

			<h2>{ __( 'Plugin Status', 'dsuite-redirects' ) }</h2>

			{ status.length > 0 && <PluginStatus status={ status } /> }
			{ status.length === 0 && (
				<div className="placeholder-inline">
					<div className="wpl-placeholder__loading"></div>
				</div>
			) }

			<h2>{ __( 'Plugin Debug', 'dsuite-redirects' ) }</h2>
			<p>
				{ __(
					'This information is provided for debugging purposes. Be careful making any changes.',
					'dsuite-redirects'
				) }
			</p>

			{ debug && <Debug debug={ debug } /> }
			{ ! debug && (
				<div className="placeholder-inline">
					<div className="wpl-placeholder__loading"></div>
				</div>
			) }
		</>
	);
}

export default Status;
