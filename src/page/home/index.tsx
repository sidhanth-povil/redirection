import { useCallback, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import WelcomeWizard from 'component/welcome-wizard';
import DatabaseUpdate from './database-update';
import { Snackbar, ErrorBoundary, Error } from '@wp-plugin-components';
import DebugReport from './debug';
import ErrorDetails from './error-details';
import CrashHandler from './crash-handler';
import PageContent from './page-content';
import { getErrorLinks, getErrorDetails } from 'lib/error-links';
import CacheDetect from './cache-detect';
import UpdateNotice from './update-notice';
import { getInitialError, getInitialLog, getInitialGroup, getInitialRedirect } from 'lib/log-constants';
import { useMessageStore, useSettingsStore, useTableStore } from 'stores';
import { has_capability, CAP_REDIRECT_ADD } from 'lib/capabilities';
import { allowedRoutes, getRouteLabel, pageForRoute, resolveRoute, useRoute, type RouteName } from 'app/router';
import Shell from 'app/shell';
import { Button } from 'ui';
import './style.scss';

const ALLOWED_ROUTES = allowedRoutes( Redirectioni10n?.caps?.pages || [] );

export default function Home() {
	// Access store properties directly to avoid creating new objects on every render
	const errors = useMessageStore( ( state ) => state.errors );
	const notices = useMessageStore( ( state ) => state.notices );
	const { clearErrors, clearNotices } = useMessageStore();

	const databaseStatus = useSettingsStore( ( state ) => state.database.status );
	const showDatabase = useSettingsStore( ( state ) => state.showDatabase );
	const inProgress = useSettingsStore( ( state ) => state.database.inProgress );
	const pluginUpdate = useSettingsStore( ( state ) => state.values?.plugin_update ?? '' );
	const { setShowDatabase, setApi } = useSettingsStore();
	const { setErrorsTable, setLogsTable, setRedirectsTable, setRedirectsAddTop, setGroupsTable } = useTableStore();

	const route = useRoute();
	const current = resolveRoute( route.name, ALLOWED_ROUTES );

	// Initialize API routes, preloaded settings, and database status from global config on mount
	useEffect( () => {
		if ( window.Redirectioni10n?.api?.routes ) {
			setApi( {
				routes: window.Redirectioni10n.api.routes,
				current: window.Redirectioni10n.api.current ?? '',
			} );
		}

		// Initialize settings from preloaded data if available
		if ( window.Redirectioni10n?.settings && ! useSettingsStore.getState().values ) {
			const { setValues, setLoadStatus } = useSettingsStore.getState();
			setValues( window.Redirectioni10n.settings as any );
			setLoadStatus( 'success' );
		}

		// Initialize database status from preloaded data
		if ( window.Redirectioni10n?.database ) {
			const { setDatabase } = useSettingsStore.getState();
			setDatabase( window.Redirectioni10n.database as any );
		}
	}, [ setApi ] );

	// Same as upstream's menu click: a sidebar click starts the target page from a clean table.
	const onNavigate = useCallback(
		( name: RouteName ) => {
			clearErrors();

			if ( name === '404s' ) {
				setErrorsTable( getInitialError() as any );
			} else if ( name === 'logs' ) {
				setLogsTable( getInitialLog() as any );
			} else if ( name === 'redirects' ) {
				setRedirectsTable( getInitialRedirect() as any );
			} else if ( name === 'groups' ) {
				setGroupsTable( getInitialGroup() as any );
			}
		},
		[ clearErrors, setErrorsTable, setLogsTable, setRedirectsTable, setGroupsTable ]
	);

	if ( REDIRECTION_VERSION !== Redirectioni10n.version ) {
		return <CacheDetect />;
	}

	const page = current === null ? '' : pageForRoute( current );

	if ( databaseStatus === 'need-install' || databaseStatus === 'finish-install' ) {
		return (
			<ErrorBoundary renderCrash={ CrashHandler } extra={ { page } }>
				<WelcomeWizard />
			</ErrorBoundary>
		);
	}

	const needsUpgrader =
		pluginUpdate === 'prompt' && ( databaseStatus === 'need-update' || databaseStatus === 'finish-update' );

	return (
		<ErrorBoundary renderCrash={ CrashHandler } extra={ { page } }>
			{ needsUpgrader && (
				<div className="redirection">
					<DatabaseUpdate onShowUpgrade={ () => setShowDatabase( true ) } showDatabase={ showDatabase } />
				</div>
			) }

			{ current !== null && ! inProgress && databaseStatus !== 'finish-update' && ! showDatabase && (
				<Shell
					routes={ ALLOWED_ROUTES }
					current={ current }
					title={ getRouteLabel( current ) }
					onNavigate={ onNavigate }
					actions={
						current === 'redirects' && has_capability( CAP_REDIRECT_ADD ) ? (
							<Button variant="primary" onClick={ () => setRedirectsAddTop( true ) }>
								{ __( 'Add redirect', 'dsuite-redirects' ) }
							</Button>
						) : null
					}
				>
					<UpdateNotice />

					<Error
						errors={ errors }
						onClear={ () => clearErrors() }
						renderDebug={ DebugReport }
						details={ getErrorDetails() }
						links={ getErrorLinks() }
						locale="redirection"
					>
						<ErrorDetails />
					</Error>

					<PageContent route={ current } />

					<Snackbar
						notices={ notices }
						onClear={ () => clearNotices() }
						snackBarViewText={ __( 'View notice', 'dsuite-redirects' ) }
					/>
				</Shell>
			) }
		</ErrorBoundary>
	);
}
