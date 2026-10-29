import { useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Badge } from 'ui';
import type { Redirect, RedirectTestResult } from 'types';
import { useRedirectTest } from 'lib/api/hooks';
import { copyText } from 'page/export/download';
import { describeTarget, isWildcardRow, scheduleBadge, typeBadge } from './describe';

interface RedirectTableProps {
	rows: Redirect[];
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

const COPIED_MS = 2000;

// A wildcard or regex isn't one URL, so it can't be copied or requested.
function isSingleAddress( row: Redirect ): boolean {
	return row.match_type === 'url' && ! row.regex && ! isWildcardRow( row );
}

/**
 * Copies the full short link (for print, QR or a social bio). Only for plain sources: a wildcard or regex isn't one URL.
 *
 * @param props
 * @param props.url Source path.
 */
function CopyLink( { url }: { url: string } ) {
	const [ copied, setCopied ] = useState( false );

	const onCopy = () => {
		copyText( window.location.origin + url )
			.then( () => {
				setCopied( true );
				window.setTimeout( () => setCopied( false ), COPIED_MS );
			} )
			// Nothing to roll back; the label simply stays "Copy link" so the user can retry or copy by hand.
			.catch( () => setCopied( false ) );
	};

	return (
		<button type="button" className="dsr-link" onClick={ onCopy } aria-live="polite">
			{ copied ? __( 'Copied', 'dsuite-redirects' ) : __( 'Copy link', 'dsuite-redirects' ) }
		</button>
	);
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
function TestLink( { id }: { id: number } ) {
	const test = useRedirectTest();
	const [ outcome, setOutcome ] = useState< TestOutcome | null >( null );

	const onTest = () =>
		test.mutate( id, {
			onSuccess: ( result ) => setOutcome( describeTest( result ) ),
			onError: ( error ) => setOutcome( { ok: false, text: error.message } ),
		} );

	return (
		<>
			<button type="button" className="dsr-link" onClick={ onTest } disabled={ test.isPending }>
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

export default function RedirectTable( props: RedirectTableProps ) {
	const { rows, loading, selected, canEdit, canDelete, empty, onSelect, onEdit, onToggle, onDelete } = props;

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
		<table className="dsr-table">
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
					<th className="dsr-table__type">{ __( 'Type', 'dsuite-redirects' ) }</th>
					<th className="dsr-table__hits dsr-num">{ __( 'Hits', 'dsuite-redirects' ) }</th>
					<th className="dsr-table__last">{ __( 'Last hit', 'dsuite-redirects' ) }</th>
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
								<span className="dsr-table__source" title={ row.url }>
									{ row.url }
								</span>
								<span className="dsr-table__target" title={ target }>
									→ { target }
								</span>
							</td>
							<td className="dsr-table__type">
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
							</td>
							<td className="dsr-table__hits dsr-num" data-label={ __( 'Hits', 'dsuite-redirects' ) }>
								{ row.hits ?? 0 }
							</td>
							<td className="dsr-table__last" data-label={ __( 'Last hit', 'dsuite-redirects' ) }>
								{ row.last_access && row.last_access !== '-' ? row.last_access : '–' }
							</td>
							<td className="dsr-table__actions">
								{ isSingleAddress( row ) && <CopyLink url={ row.url } /> }
								{ isSingleAddress( row ) && [ 'url', 'error' ].includes( row.action_type ) && (
									<TestLink id={ row.id } />
								) }
								{ canEdit && (
									<button type="button" className="dsr-link" onClick={ () => onEdit( row ) }>
										{ __( 'Edit', 'dsuite-redirects' ) }
									</button>
								) }
								{ canEdit && (
									<button type="button" className="dsr-link" onClick={ () => onToggle( row ) }>
										{ isDisabled
											? __( 'Enable', 'dsuite-redirects' )
											: __( 'Disable', 'dsuite-redirects' ) }
									</button>
								) }
								{ canDelete && (
									<button
										type="button"
										className="dsr-link dsr-link--danger"
										onClick={ () => onDelete( row ) }
									>
										{ __( 'Delete', 'dsuite-redirects' ) }
									</button>
								) }
							</td>
						</tr>
					);
				} ) }
			</tbody>
		</table>
	);
}
