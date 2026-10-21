import { __ } from '@wordpress/i18n';
import type { RouteName } from 'app/router';
import { has_page_access } from 'lib/capabilities';

import Options from 'page/options';
import Support from 'page/support';
import Site from 'page/site';
import Logs from 'page/logs';
import Logs404 from 'page/logs404';
import ImportPage from 'page/import';
import ExportPage from 'page/export';
import Groups from 'page/groups';
import Redirects from 'page/redirects';

interface PageContentProps {
	route: RouteName;
}

function PageContent( { route }: PageContentProps ) {
	switch ( route ) {
		case 'support':
			return <Support />;

		case '404s':
			return <Logs404 />;

		case 'logs':
			return <Logs />;

		case 'import-export':
			return (
				<>
					{ has_page_access( 'import' ) && (
						<>
							<h2 className="dsr-section-title">{ __( 'Import', 'dsuite-redirects' ) }</h2>
							<ImportPage />
						</>
					) }
					{ has_page_access( 'export' ) && (
						<>
							<h2 className="dsr-section-title">{ __( 'Export', 'dsuite-redirects' ) }</h2>
							<ExportPage />
						</>
					) }
				</>
			);

		case 'groups':
			return <Groups />;

		case 'settings':
			return <Options />;

		case 'site':
			return <Site />;

		case 'redirects':
			return <Redirects />;
	}
}

export default PageContent;
