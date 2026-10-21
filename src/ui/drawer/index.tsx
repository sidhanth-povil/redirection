import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { __ } from '@wordpress/i18n';
import './style.scss';

interface DrawerProps {
	open: boolean;
	title: string;
	onClose: () => void;
	footer?: ReactNode;
	children: ReactNode;
}

export function Drawer( { open, title, onClose, footer, children }: DrawerProps ) {
	const titleId = useId();

	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}

		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( event.key === 'Escape' ) {
				onClose();
			}
		};

		document.addEventListener( 'keydown', onKeyDown );

		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [ open, onClose ] );

	if ( ! open ) {
		return null;
	}

	// Portalled to <body> so wp-admin layout can't clip it; .dsr-app re-applies the design tokens there.
	return createPortal(
		<div className="dsr-app dsr-drawer-root">
			{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Escape is the keyboard path */ }
			<div className="dsr-drawer__backdrop" onClick={ onClose } />
			<FocusLock returnFocus>
				<div className="dsr-drawer" role="dialog" aria-modal="true" aria-labelledby={ titleId }>
					<header className="dsr-drawer__header">
						<h2 id={ titleId } className="dsr-drawer__title">
							{ title }
						</h2>
						<button
							type="button"
							className="dsr-drawer__close"
							onClick={ onClose }
							aria-label={ __( 'Close', 'dsuite-redirects' ) }
						>
							×
						</button>
					</header>
					<div className="dsr-drawer__body">{ children }</div>
					{ footer && <footer className="dsr-drawer__footer">{ footer }</footer> }
				</div>
			</FocusLock>
		</div>,
		document.body
	);
}
