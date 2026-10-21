import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { buildHash, getRouteLabel, type RouteName } from 'app/router';
import 'ui';
import './style.scss';

interface ShellProps {
	routes: RouteName[];
	current: RouteName;
	title: string;
	actions?: ReactNode;
	onNavigate?: ( name: RouteName ) => void;
	children: ReactNode;
}

export default function Shell( { routes, current, title, actions, onNavigate, children }: ShellProps ) {
	return (
		<div className="dsr-shell notranslate" translate="no">
			<nav className="dsr-nav" aria-label={ __( 'DSuite Redirects', 'dsuite-redirects' ) }>
				<ul className="dsr-nav__list">
					{ routes.map( ( name ) => (
						<li key={ name } className="dsr-nav__item">
							<a
								className="dsr-nav__link"
								href={ buildHash( name ) }
								aria-current={ name === current ? 'page' : undefined }
								onClick={ () => onNavigate?.( name ) }
							>
								{ getRouteLabel( name ) }
							</a>
						</li>
					) ) }
				</ul>
			</nav>

			<div className="dsr-main redirection">
				<header className="dsr-header">
					<h1 className="dsr-header__title">{ title }</h1>
					{ actions && <div className="dsr-header__actions">{ actions }</div> }
				</header>

				{ children }
			</div>
		</div>
	);
}
