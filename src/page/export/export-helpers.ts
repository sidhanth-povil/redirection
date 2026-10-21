import { __ } from '@wordpress/i18n';
import type { ExportFormat, ExportType, RedirectModule, RedirectScopeType } from './types';

function getExportTypeLabel( exportType: ExportType ) {
	if ( exportType === 'redirect' ) {
		return __( 'Redirects', 'dsuite-redirects' );
	}

	if ( exportType === 'log' ) {
		return __( 'Redirect logs', 'dsuite-redirects' );
	}

	if ( exportType === '404' ) {
		return __( '404 logs', 'dsuite-redirects' );
	}

	if ( exportType === 'group' ) {
		return __( 'Groups', 'dsuite-redirects' );
	}

	return __( 'Settings', 'dsuite-redirects' );
}

function getExportTypesLabel( exportTypes: ExportType[] ) {
	return exportTypes.map( ( exportType ) => getExportTypeLabel( exportType ) ).join( ', ' );
}

function getRedirectModuleLabel( redirectModule: RedirectModule ) {
	if ( redirectModule === '1' ) {
		return __( 'WordPress redirects', 'dsuite-redirects' );
	}

	if ( redirectModule === '2' ) {
		return __( 'Apache redirects', 'dsuite-redirects' );
	}

	if ( redirectModule === '3' ) {
		return __( 'Nginx redirects', 'dsuite-redirects' );
	}

	return __( 'Everything', 'dsuite-redirects' );
}

function getRedirectScopeLabel( scopeType: RedirectScopeType, groupName: string ) {
	if ( scopeType === 'module' ) {
		return __( 'Module', 'dsuite-redirects' );
	}

	if ( scopeType === 'group' ) {
		return groupName;
	}

	return __( 'Everything', 'dsuite-redirects' );
}

function getExportFormatLabel( format: ExportFormat ) {
	if ( format === 'json' ) {
		return __( 'JSON', 'dsuite-redirects' );
	}

	if ( format === 'csv' ) {
		return __( 'CSV', 'dsuite-redirects' );
	}

	if ( format === 'apache' ) {
		return __( 'Apache .htaccess', 'dsuite-redirects' );
	}

	if ( format === 'redirects-file' ) {
		return __( '_redirects (Netlify/Cloudflare)', 'dsuite-redirects' );
	}

	return __( 'Nginx rewrite rules', 'dsuite-redirects' );
}

function getExportFormatOptionLabel( format: ExportFormat ) {
	if ( format === 'json' ) {
		return __( 'JSON (complete data)', 'dsuite-redirects' );
	}

	return getExportFormatLabel( format );
}

function getExportFilename( exportType: ExportType, format: ExportFormat ) {
	if ( format === 'redirects-file' ) {
		return '_redirects';
	}

	if ( exportType === 'redirect' ) {
		if ( format === 'apache' ) {
			return 'redirects.htaccess';
		}

		if ( format === 'nginx' ) {
			return 'redirects.nginx';
		}

		return `redirects.${ format }`;
	}

	if ( exportType === 'log' ) {
		return `redirect-logs.${ format }`;
	}

	if ( exportType === '404' ) {
		return `404-logs.${ format }`;
	}

	if ( exportType === 'group' ) {
		return `groups.${ format }`;
	}

	return `settings.${ format }`;
}

function getExportSelectionFilename( exportTypes: ExportType[], format: ExportFormat ) {
	if ( exportTypes.length === 1 && exportTypes[ 0 ] ) {
		return getExportFilename( exportTypes[ 0 ], format );
	}

	return `redirection-export.${ format }`;
}

export {
	getExportFilename,
	getExportFormatLabel,
	getExportFormatOptionLabel,
	getExportSelectionFilename,
	getExportTypeLabel,
	getExportTypesLabel,
	getRedirectModuleLabel,
	getRedirectScopeLabel,
};
