import { useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useDebouncedCallback } from 'use-debounce';
import { useExport, useLogBulkAction, useLogList } from 'lib/api/hooks';
import { cleanApiParams, getShowFilter } from 'lib/api/utils';
import { useTableUrlSync } from 'lib/hooks';
import { getRssUrl } from 'lib/wordpress-url';
import { has_capability, CAP_LOG_DELETE } from 'lib/capabilities';
import { useSettingsStore, useTableStore } from 'stores';
import { buildHash } from 'app/router';
import { Button } from 'ui';
// Shared list styles (.dsr-table, .dsr-chip, …).
import '../redirects/style.scss';
import { getExportFilename } from 'page/export/export-helpers';
import type { Log } from 'types';

const SEARCH_DELAY = 300;

interface Chip {
	label: string;
	groupBy: string;
}

function getChips( hasIp: boolean ): Chip[] {
	return [
		{ label: __( 'All hits', 'dsuite-redirects' ), groupBy: '' },
		{ label: __( 'By URL', 'dsuite-redirects' ), groupBy: 'url' },
		...( hasIp ? [ { label: __( 'By IP', 'dsuite-redirects' ), groupBy: 'ip' } ] : [] ),
		{ label: __( 'By agent', 'dsuite-redirects' ), groupBy: 'agent' },
	];
}

/** What a grouped row is grouped on. */
function groupValue( row: Log, groupBy: string ): string {
	const value = groupBy === 'ip' ? row.ip : groupBy === 'agent' ? row.agent : row.url;

	return value ?? String( row.id );
}

export default function Logs() {
	const table = useTableStore( ( store ) => store.logs );
	const { setLogsTable } = useTableStore();
	const settings = useSettingsStore( ( store ) => store.values );

	useTableUrlSync( {
		table,
		setTable: setLogsTable,
		allowedGroup: [ 'url', 'ip', 'agent' ],
		allowedFilters: [ 'url', 'url-exact', 'referrer', 'agent', 'ip', 'target', 'domain', 'method', 'redirect_by' ],
		pageName: 'log',
	} );

	const { data, isFetching } = useLogList( table );
	const remove = useLogBulkAction();
	const exporter = useExport();
	const rows: Log[] = data?.items ?? [];
	const total = data?.total ?? 0;
	const pages = Math.max( 1, Math.ceil( total / table.per_page ) );

	const hasIp = Number( settings?.ip_logging ?? 0 ) > 0;
	const token = settings?.token ?? '';
	const canDelete = has_capability( CAP_LOG_DELETE );
	const groupBy = table.groupBy ?? '';
	const filterBy: Record< string, string > = table.filterBy || {};
	const { url: searchUrl, ...linkFilters } = filterBy;
	const hasLinkFilters = Object.keys( linkFilters ).length > 0;
	const groupParams = groupBy ? { groupBy } : {};
	const selected = table.selected;

	const [ search, setSearch ] = useState( searchUrl ?? '' );

	const setFilter = ( next: Record< string, string > ) =>
		setLogsTable( { filterBy: next, page: 0, selected: [], selectAll: false } );

	const applySearch = useDebouncedCallback( ( value: string ) => {
		setFilter( value.trim() === '' ? linkFilters : { ...linkFilters, url: value.trim() } );
	}, SEARCH_DELAY );

	const deleteItems = ( items: ( string | number )[], message: string ) => {
		if ( window.confirm( message ) ) {
			remove.mutate( { action: 'delete', items, params: groupParams } );
		}
	};

	const exportSelected = () => {
		exporter.mutate( {
			exportType: 'log',
			format: 'csv',
			download: true,
			filename: getExportFilename( 'log', 'csv' ),
			params: cleanApiParams( { ...groupParams, items: selected } ),
		} as any );
		setLogsTable( { selected: [], selectAll: false } );
	};

	const toggleRow = ( id: string | number ) =>
		setLogsTable( {
			selected: selected.includes( id ) ? selected.filter( ( item ) => item !== id ) : [ ...selected, id ],
			selectAll: false,
		} );
	const allSelected = rows.length > 0 && rows.every( ( row ) => selected.includes( row.id ) );

	return (
		<div className="dsr-redirects">
			<div className="dsr-toolbar">
				<div className="dsr-search">
					<label className="screen-reader-text" htmlFor="dsr-log-search">
						{ __( 'Search logs', 'dsuite-redirects' ) }
					</label>
					<input
						id="dsr-log-search"
						type="search"
						className="dsr-input"
						placeholder={ __( 'Search URLs…', 'dsuite-redirects' ) }
						value={ search }
						onChange={ ( event ) => {
							setSearch( event.target.value );
							applySearch( event.target.value );
						} }
					/>
				</div>

				<div className="dsr-chips" role="group" aria-label={ __( 'Show', 'dsuite-redirects' ) }>
					{ getChips( hasIp ).map( ( chip ) => (
						<button
							key={ chip.groupBy }
							type="button"
							className="dsr-chip"
							aria-pressed={ groupBy === chip.groupBy }
							onClick={ () => setLogsTable( { groupBy: chip.groupBy, page: 0, selected: [] } ) }
						>
							{ chip.label }
						</button>
					) ) }
					{ hasLinkFilters && (
						<button
							type="button"
							className="dsr-chip"
							aria-pressed
							onClick={ () => setFilter( searchUrl ? { url: searchUrl } : {} ) }
						>
							{ sprintf(
								/* translators: %s: active filters, e.g. "referrer: news.test" */
								__( 'Clear filter: %s', 'dsuite-redirects' ),
								Object.entries( linkFilters )
									.map( ( [ key, value ] ) => key + ': ' + value )
									.join( ', ' )
							) }
						</button>
					) }
				</div>

				{ token && (
					<a className="dsr-link" href={ getRssUrl( token ) }>
						{ __( 'RSS', 'dsuite-redirects' ) }
					</a>
				) }
			</div>

			{ selected.length > 0 && (
				<div className="dsr-bulkbar" role="region" aria-label={ __( 'Bulk actions', 'dsuite-redirects' ) }>
					<span className="dsr-bulkbar__count">
						{ sprintf(
							/* translators: %d: number of selected log rows */
							_n( '%d selected', '%d selected', selected.length, 'dsuite-redirects' ),
							selected.length
						) }
					</span>
					<Button onClick={ exportSelected }>{ __( 'Export CSV', 'dsuite-redirects' ) }</Button>
					{ canDelete && (
						<Button
							onClick={ () =>
								deleteItems(
									selected,
									__( 'Are you sure you want to delete the selected items?', 'dsuite-redirects' )
								)
							}
						>
							{ __( 'Delete selected', 'dsuite-redirects' ) }
						</Button>
					) }
				</div>
			) }

			{ rows.length === 0 ? (
				<div className="dsr-empty">
					{ isFetching && ! data
						? __( 'Loading logs…', 'dsuite-redirects' )
						: __( 'No redirect hits logged yet.', 'dsuite-redirects' ) }
				</div>
			) : (
				<table className="dsr-table">
					<thead>
						<tr>
							<th className="dsr-table__check">
								<input
									type="checkbox"
									aria-label={ __( 'Select all on this page', 'dsuite-redirects' ) }
									checked={ allSelected }
									onChange={ () =>
										setLogsTable( {
											selected: allSelected ? [] : rows.map( ( row ) => row.id ),
											selectAll: false,
										} )
									}
								/>
							</th>
							{ groupBy ? (
								<>
									<th>{ getChips( true ).find( ( chip ) => chip.groupBy === groupBy )?.label }</th>
									<th className="dsr-table__hits dsr-num">{ __( 'Hits', 'dsuite-redirects' ) }</th>
								</>
							) : (
								<>
									<th className="dsr-table__last">{ __( 'Date', 'dsuite-redirects' ) }</th>
									<th>{ __( 'Redirect', 'dsuite-redirects' ) }</th>
									<th>{ __( 'Visitor', 'dsuite-redirects' ) }</th>
								</>
							) }
							<th className="dsr-table__actions">
								<span className="screen-reader-text">{ __( 'Actions', 'dsuite-redirects' ) }</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ rows.map( ( row ) => {
							const value = groupValue( row, groupBy );

							return (
								<tr key={ row.id }>
									<td className="dsr-table__check">
										<input
											type="checkbox"
											/* translators: %s: URL, IP or user agent */
											aria-label={ sprintf( __( 'Select %s', 'dsuite-redirects' ), value ) }
											checked={ selected.includes( row.id ) }
											onChange={ () => toggleRow( row.id ) }
										/>
									</td>
									{ groupBy ? (
										<>
											<td className="dsr-table__redirect">
												<span className="dsr-table__source" title={ value }>
													{ value }
												</span>
											</td>
											<td
												className="dsr-table__hits dsr-num"
												data-label={ __( 'Hits', 'dsuite-redirects' ) }
											>
												{ row.count ?? 0 }
											</td>
										</>
									) : (
										<>
											<td className="dsr-table__last" data-label={ __( 'Date', 'dsuite-redirects' ) }>
												{ row.created } { row.created_time }
											</td>
											<td className="dsr-table__redirect">
												<span className="dsr-table__source" title={ row.url }>
													{ row.url }
												</span>
												{ row.sent_to && (
													<span className="dsr-table__target" title={ row.sent_to }>
														→ { row.sent_to }
													</span>
												) }
											</td>
											<td className="dsr-table__redirect">
												{ row.agent && (
													<span className="dsr-table__target" title={ row.agent }>
														{ row.agent }
													</span>
												) }
												{ row.ip && <span className="dsr-table__target">{ row.ip }</span> }
											</td>
										</>
									) }
									<td className="dsr-table__actions">
										{ ! groupBy && row.redirection_id ? (
											<a
												className="dsr-link"
												href={ buildHash( 'redirects', {
													'filterby[id]': String( row.redirection_id ),
												} ) }
											>
												{ __( 'View redirect', 'dsuite-redirects' ) }
											</a>
										) : null }
										{ groupBy && (
											<button
												type="button"
												className="dsr-link"
												onClick={ () =>
													setLogsTable( {
														filterBy: getShowFilter( groupBy, String( row.id ) ),
														groupBy: '',
														page: 0,
														selected: [],
														selectAll: false,
													} )
												}
											>
												{ __( 'Show all', 'dsuite-redirects' ) }
											</button>
										) }
										{ canDelete && (
											<button
												type="button"
												className="dsr-link dsr-link--danger"
												onClick={ () =>
													deleteItems(
														[ row.id ],
														__(
															'Are you sure you want to delete this item?',
															'dsuite-redirects'
														)
													)
												}
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
			) }

			{ pages > 1 && (
				<nav className="dsr-pagination" aria-label={ __( 'Pagination', 'dsuite-redirects' ) }>
					<Button
						disabled={ table.page === 0 }
						onClick={ () => setLogsTable( { page: table.page - 1, selected: [] } ) }
					>
						{ __( 'Previous', 'dsuite-redirects' ) }
					</Button>
					<span>
						{ sprintf(
							/* translators: 1: current page, 2: total pages */
							__( 'Page %1$d of %2$d', 'dsuite-redirects' ),
							table.page + 1,
							pages
						) }
					</span>
					<Button
						disabled={ table.page + 1 >= pages }
						onClick={ () => setLogsTable( { page: table.page + 1, selected: [] } ) }
					>
						{ __( 'Next', 'dsuite-redirects' ) }
					</Button>
				</nav>
			) }
		</div>
	);
}
