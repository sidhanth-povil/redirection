import { useState, type ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useHealth, useRedirectUpdate } from 'lib/api/hooks';
import { has_capability, CAP_REDIRECT_ADD } from 'lib/capabilities';
import { Badge, Button, type BadgeTone } from 'ui';
import type { AttentionItem, Redirect } from 'types';
import RedirectDrawer from 'page/redirects/redirect-drawer';
import { withTarget } from 'page/redirects/model';
import './style.scss';

interface DrawerTarget {
	item: Redirect | null;
	url: string;
}

interface Tile {
	label: string;
	value: number;
}

function hits( count: number ): string {
	/* translators: %d: number of visits */
	return sprintf( _n( '%d hit', '%d hits', count, 'dsuite-redirects' ), count );
}

function describeItem( item: AttentionItem ): { tone: BadgeTone; label: string; title: string; meta: string } {
	switch ( item.type ) {
		case '404':
			return {
				tone: 'danger',
				label: __( '404', 'dsuite-redirects' ),
				title: item.url,
				/* translators: %s: e.g. "12 hits" */
				meta: sprintf( __( '%s this week', 'dsuite-redirects' ), hits( item.hits ) ),
			};
		case 'loop':
			return {
				tone: 'danger',
				label: __( 'Loop', 'dsuite-redirects' ),
				title: item.path.join( ' → ' ),
				meta: __( 'Visitors never arrive. Change one of these redirects.', 'dsuite-redirects' ),
			};
		case 'chain':
			return {
				tone: 'warning',
				label: __( 'Chain', 'dsuite-redirects' ),
				title: item.path.join( ' → ' ),
				meta: sprintf(
					/* translators: 1: e.g. "12 hits", 2: final destination */
					__( '%1$s · can point straight to %2$s', 'dsuite-redirects' ),
					hits( item.hits ),
					item.final_target
				),
			};
		case 'expiring':
			return {
				tone: 'warning',
				label: __( 'Ends soon', 'dsuite-redirects' ),
				title: item.redirect.url,
				meta: sprintf(
					/* translators: %s: date and time the redirect stops */
					__( 'Stops on %s', 'dsuite-redirects' ),
					new Date( item.end_at ?? '' ).toLocaleString()
				),
			};
	}
}

export default function Overview() {
	const { data, isLoading, refetch } = useHealth();
	const update = useRedirectUpdate();
	const [ drawer, setDrawer ] = useState< DrawerTarget | null >( null );
	const canEdit = has_capability( CAP_REDIRECT_ADD );

	if ( ! data ) {
		return isLoading ? <p className="dsr-empty">{ __( 'Loading…', 'dsuite-redirects' ) }</p> : null;
	}

	const { counts, attention } = data;
	const tiles: Tile[] = [
		{ label: __( 'Active redirects', 'dsuite-redirects' ), value: counts.active },
		{ label: __( 'New 404s (7 days)', 'dsuite-redirects' ), value: counts.new404s },
		{ label: __( 'Chains & loops', 'dsuite-redirects' ), value: counts.chains + counts.loops },
		{ label: __( 'Scheduled (7 days)', 'dsuite-redirects' ), value: counts.scheduled },
	];

	const action = ( item: AttentionItem ): ReactNode => {
		if ( ! canEdit ) {
			return null;
		}

		if ( item.type === '404' ) {
			return (
				<Button onClick={ () => setDrawer( { item: null, url: item.url } ) }>
					{ __( 'Fix', 'dsuite-redirects' ) }
				</Button>
			);
		}

		if ( item.redirect === null ) {
			return null;
		}

		const stored = item.redirect;

		if ( item.type === 'chain' ) {
			return (
				<Button
					disabled={ update.isPending }
					onClick={ () =>
						update.mutate(
							{ id: stored.id, ...withTarget( stored, item.final_target ) },
							{ onSuccess: () => refetch() }
						)
					}
				>
					{ __( 'Flatten', 'dsuite-redirects' ) }
				</Button>
			);
		}

		// Loops need a human decision, so they get the drawer rather than a one-click fix.
		return (
			<Button onClick={ () => setDrawer( { item: stored, url: '' } ) }>
				{ item.type === 'expiring' ? __( 'Extend', 'dsuite-redirects' ) : __( 'Edit', 'dsuite-redirects' ) }
			</Button>
		);
	};

	return (
		<div className="dsr-overview">
			<ul className="dsr-kpis" aria-label={ __( 'Summary', 'dsuite-redirects' ) }>
				{ tiles.map( ( tile ) => (
					<li key={ tile.label } className="dsr-kpi">
						<span className="dsr-kpi__value">{ tile.value }</span>
						<span className="dsr-kpi__label">{ tile.label }</span>
					</li>
				) ) }
			</ul>

			<section className="dsr-attention" aria-labelledby="dsr-attention-title">
				<h2 id="dsr-attention-title" className="dsr-section-title">
					{ __( 'Needs attention', 'dsuite-redirects' ) }
				</h2>

				{ attention.length === 0 ? (
					<div className="dsr-empty">{ __( 'All clear. Nothing needs attention.', 'dsuite-redirects' ) }</div>
				) : (
					<ul className="dsr-attention__list">
						{ attention.map( ( item ) => {
							const { tone, label, title, meta } = describeItem( item );

							return (
								<li
									key={ item.type + ( item.type === '404' ? item.url : item.id ) }
									className="dsr-attention__item"
								>
									<Badge tone={ tone }>{ label }</Badge>
									<div className="dsr-attention__text">
										<span className="dsr-attention__title" title={ title }>
											{ title }
										</span>
										<span className="dsr-attention__meta">{ meta }</span>
									</div>
									{ action( item ) }
								</li>
							);
						} ) }
					</ul>
				) }
			</section>

			{ drawer && (
				<RedirectDrawer
					key={ drawer.item?.id ?? 'new' }
					item={ drawer.item }
					initialUrl={ drawer.url }
					onClose={ () => {
						setDrawer( null );
						refetch();
					} }
				/>
			) }
		</div>
	);
}
