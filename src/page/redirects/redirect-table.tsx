import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Badge } from 'ui';
import type { Redirect } from 'types';
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
