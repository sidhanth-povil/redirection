import { useState, type ReactNode } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Badge } from 'ui';
import type { Redirect, RedirectTestResult } from 'types';
import { useRedirectTest } from 'lib/api/hooks';
import { useMessageStore } from 'stores';
import { copyText } from 'page/export/download';
import { downloadQr } from 'lib/qr';
import { describeTarget, isWildcardRow, scheduleBadge, typeBadge } from './describe';

interface RedirectTableProps {
	rows: Redirect[];
	/** Group names by ID: groups double as each redirect's purpose (Print QR, Meta Ad…). */
	groupNames: Record< number, string >;
	loading: boolean;
	selected: number[];
	canEdit: boolean;
	canDelete: boolean;
	empty: ReactNode;
	onSelect: ( ids: number[] ) => void;
	onEdit: ( row: Redirect ) => void;
	onToggle: ( row: Redirect ) => void;
	onDelete: ( row: Redirect ) => void;
}

// A wildcard or regex isn't one URL, so it can't be copied, encoded or requested.
function isSingleAddress( row: Redirect ): boolean {
	return row.match_type === 'url' && ! row.regex && ! isWildcardRow( row );
}

function isTestable( row: Redirect ): boolean {
	return isSingleAddress( row ) && [ 'url', 'error' ].includes( row.action_type );
}

interface TestOutcome {
	ok: boolean;
	text: string;
}

function describeTest( result: RedirectTestResult ): TestOutcome {
	const timing = sprintf( /* translators: %d: milliseconds */ __( '%d ms', 'dsuite-redirects' ), result.ms );
	const where = result.location === '' ? String( result.code ) : `${ result.code } → ${ result.location }`;

	if ( ! result.ok ) {
		/* translators: %s: HTTP status and destination, e.g. "404" or "301 → /other/" */
		return { ok: false, text: `✕ ${ sprintf( __( 'Got %s', 'dsuite-redirects' ), where ) } · ${ timing }` };
	}

	const parts = [ `✓ ${ where }`, timing ];
	if ( result.utm_preserved !== null ) {
		parts.push(
			result.utm_preserved ? __( 'tracking kept', 'dsuite-redirects' ) : __( 'tracking lost', 'dsuite-redirects' )
		);
	}

	return { ok: true, text: parts.join( ' · ' ) };
}

/**
 * Asks the server where the redirect goes, so the marketer's browser never caches a 301 they are about to change.
 *
 * @param props
 * @param props.id Redirect ID.
 */
function TestButton( { id }: { id: number } ) {
	const test = useRedirectTest();
	const [ outcome, setOutcome ] = useState< TestOutcome | null >( null );

	const onTest = () =>
		test.mutate( id, {
			onSuccess: ( result ) => setOutcome( describeTest( result ) ),
			onError: ( error ) => setOutcome( { ok: false, text: error.message } ),
		} );

	return (
		<>
			<button type="button" className="dsr-row-action" onClick={ onTest } disabled={ test.isPending }>
				{ test.isPending ? __( 'Testing…', 'dsuite-redirects' ) : __( 'Test', 'dsuite-redirects' ) }
			</button>
			{ outcome && (
				<span role="status" className={ outcome.ok ? 'dsr-test-result' : 'dsr-test-result is-bad' }>
					{ outcome.text }
				</span>
			) }
		</>
	);
}

interface RowMenuProps {
	row: Redirect;
	canEdit: boolean;
	canDelete: boolean;
	onToggle: ( row: Redirect ) => void;
	onDelete: ( row: Redirect ) => void;
}

/**
 * The less frequent actions, kept out of the row so it reads at a glance. Portaled, so the table's rounded,
 * overflow-hidden frame can't clip it; feedback goes to the page notice, as the menu closes on click.
 *
 * @param props
 * @param props.row       Redirect.
 * @param props.canEdit   Can enable and disable.
 * @param props.canDelete Can delete.
 * @param props.onToggle  Enable or disable.
 * @param props.onDelete  Delete.
 */
function RowMenu( { row, canEdit, canDelete, onToggle, onDelete }: RowMenuProps ) {
	const addNotice = useMessageStore( ( store ) => store.addNotice );
	const isSingle = isSingleAddress( row );
	const fullUrl = window.location.origin + row.url;

	if ( ! isSingle && ! canEdit && ! canDelete ) {
		return null;
	}

	const onCopy = () =>
		copyText( fullUrl )
			.then( () => addNotice( __( 'Link copied', 'dsuite-redirects' ) ) )
			.catch( () =>
				addNotice( __( 'Could not copy. Select the address and copy it by hand.', 'dsuite-redirects' ) )
			);

	const onQr = () => {
		try {
			downloadQr( fullUrl, row.url );
		} catch {
			addNotice( __( 'This address is too long for a QR code.', 'dsuite-redirects' ) );
		}
	};

	return (
		<Menu>
			<MenuButton
				className="dsr-row-more"
				/* translators: %s: old URL */
				aria-label={ sprintf( __( 'More actions for %s', 'dsuite-redirects' ), row.url ) }
			>
				<span aria-hidden="true">⋯</span>
			</MenuButton>
			<MenuItems anchor="bottom end" className="dsr-menu" modal={ false }>
				{ isSingle && (
					<MenuItem>
						<button type="button" className="dsr-menu__item" onClick={ onCopy }>
							{ __( 'Copy link', 'dsuite-redirects' ) }
						</button>
					</MenuItem>
				) }
				{ isSingle && (
					<MenuItem>
						<button type="button" className="dsr-menu__item" onClick={ onQr }>
							{ __( 'Download QR code', 'dsuite-redirects' ) }
						</button>
					</MenuItem>
				) }
				{ canEdit && (
					<MenuItem>
						<button type="button" className="dsr-menu__item" onClick={ () => onToggle( row ) }>
							{ row.enabled === false
								? __( 'Enable', 'dsuite-redirects' )
								: __( 'Disable', 'dsuite-redirects' ) }
						</button>
					</MenuItem>
				) }
				{ canDelete && (
					<MenuItem>
						<button
							type="button"
							className="dsr-menu__item dsr-menu__item--danger"
							onClick={ () => onDelete( row ) }
						>
							{ __( 'Delete', 'dsuite-redirects' ) }
						</button>
					</MenuItem>
				) }
			</MenuItems>
		</Menu>
	);
}

function Activity( { row }: { row: Redirect } ) {
	const hits = row.hits ?? 0;
	const hasLastHit = Boolean( row.last_access ) && row.last_access !== '-';

	if ( hits === 0 ) {
		return <span className="dsr-activity__none">{ __( 'No hits yet', 'dsuite-redirects' ) }</span>;
	}

	return (
		<>
			<span className="dsr-activity__hits">
				{ sprintf(
					/* translators: %s: number of hits */
					_n( '%s hit', '%s hits', hits, 'dsuite-redirects' ),
					hits.toLocaleString()
				) }
			</span>
			{ hasLastHit && <span className="dsr-activity__last">{ row.last_access }</span> }
		</>
	);
}

export default function RedirectTable( props: RedirectTableProps ) {
	const { rows, groupNames, loading, selected, canEdit, canDelete, empty, onSelect, onEdit, onToggle, onDelete } =
		props;

	if ( loading ) {
		return <p className="dsr-empty">{ __( 'Loading redirects…', 'dsuite-redirects' ) }</p>;
	}

	if ( rows.length === 0 ) {
		return <div className="dsr-empty">{ empty }</div>;
	}

	const allSelected = rows.every( ( row ) => selected.includes( row.id ) );
	const toggleRow = ( id: number ) =>
		onSelect( selected.includes( id ) ? selected.filter( ( item ) => item !== id ) : [ ...selected, id ] );

	return (
		<table className="dsr-table dsr-redirect-table">
			<thead>
				<tr>
					<th className="dsr-table__check">
						<input
							type="checkbox"
							aria-label={ __( 'Select all on this page', 'dsuite-redirects' ) }
							checked={ allSelected }
							onChange={ () => onSelect( allSelected ? [] : rows.map( ( row ) => row.id ) ) }
						/>
					</th>
					<th>{ __( 'Redirect', 'dsuite-redirects' ) }</th>
					<th className="dsr-table__activity">{ __( 'Activity', 'dsuite-redirects' ) }</th>
					<th className="dsr-table__actions">
						<span className="screen-reader-text">{ __( 'Actions', 'dsuite-redirects' ) }</span>
					</th>
				</tr>
			</thead>
			<tbody>
				{ rows.map( ( row ) => {
					const badge = typeBadge( row );
					const schedule = scheduleBadge( row );
					const target = describeTarget( row );
					const isDisabled = row.enabled === false;
					const purpose = groupNames[ row.group_id ];

					return (
						<tr key={ row.id } className={ isDisabled ? 'is-disabled' : undefined }>
							<td className="dsr-table__check">
								<input
									type="checkbox"
									/* translators: %s: old URL */
									aria-label={ sprintf( __( 'Select %s', 'dsuite-redirects' ), row.url ) }
									checked={ selected.includes( row.id ) }
									onChange={ () => toggleRow( row.id ) }
								/>
							</td>
							<td className="dsr-table__redirect">
								{ row.title && <span className="dsr-table__title">{ row.title }</span> }
								<span className="dsr-table__headline">
									<span className="dsr-table__source" title={ row.url }>
										{ row.url }
									</span>
									<span className="dsr-table__badges">
										<Badge tone={ badge.tone } title={ String( badge.code ) }>
											{ badge.label }
										</Badge>
										{ isWildcardRow( row ) && (
											<Badge tone="accent">{ __( 'Wildcard', 'dsuite-redirects' ) }</Badge>
										) }
										{ schedule && <Badge tone={ schedule.tone }>{ schedule.label }</Badge> }
										{ isDisabled && (
											<Badge tone="neutral">{ __( 'Disabled', 'dsuite-redirects' ) }</Badge>
										) }
									</span>
								</span>
								<span className="dsr-table__target" title={ target }>
									<span aria-hidden="true">→ </span>
									{ target }
								</span>
								{ purpose && (
									<span className="dsr-table__purpose">
										<span className="screen-reader-text">
											{ __( 'Purpose:', 'dsuite-redirects' ) }{ ' ' }
										</span>
										{ purpose }
									</span>
								) }
							</td>
							<td className="dsr-table__activity">
								<Activity row={ row } />
							</td>
							<td className="dsr-table__actions">
								<span className="dsr-row-actions">
									{ isTestable( row ) && <TestButton id={ row.id } /> }
									{ canEdit && (
										<button
											type="button"
											className="dsr-row-action"
											onClick={ () => onEdit( row ) }
										>
											{ __( 'Edit', 'dsuite-redirects' ) }
										</button>
									) }
									<RowMenu
										row={ row }
										canEdit={ canEdit }
										canDelete={ canDelete }
										onToggle={ onToggle }
										onDelete={ onDelete }
									/>
								</span>
							</td>
						</tr>
					);
				} ) }
			</tbody>
		</table>
	);
}
