import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useDebouncedCallback } from 'use-debounce';
import { useErrorBulkAction, useErrorList, useGroupDropdown, useRedirectCreate } from 'lib/api/hooks';
import { useTableUrlSync } from 'lib/hooks';
import { useSettingsStore, useTableStore } from 'stores';
import { has_capability, CAP_404_DELETE, CAP_REDIRECT_ADD } from 'lib/capabilities';
import { ACTION_NOTHING, getCodeForActionType } from 'lib/redirect-constants';
import { Button } from 'ui';
// The drawer brings the shared list styles (.dsr-table, .dsr-chip, …) with it.
import RedirectDrawer from 'page/redirects/redirect-drawer';
import { createState, pickDefaultGroup, toPayload } from 'page/redirects/model';
import type { Error404 } from 'types';

const SEARCH_DELAY = 300;
const RECENT_DAYS = '7';

interface Chip {
	label: string;
	filter: Record< string, string >;
}

const getChips = (): Chip[] => [
	{ label: __( 'New this week', 'dsuite-redirects' ), filter: { since: RECENT_DAYS, ignored: '0' } },
	{ label: __( 'All', 'dsuite-redirects' ), filter: { ignored: '0' } },
	{ label: __( 'Ignored', 'dsuite-redirects' ), filter: { ignored: '1' } },
];

function sameFilter( first: Record< string, string >, second: Record< string, string > ): boolean {
	return first.since === second.since && first.ignored === second.ignored;
}

export default function Logs404() {
	const table = useTableStore( ( store ) => store.errors );
	const { setErrorsTable } = useTableStore();
	const settings = useSettingsStore( ( store ) => store.values );

	useTableUrlSync( {
		table,
		setTable: setErrorsTable,
		allowedGroup: [ 'url' ],
		allowedFilters: [ 'url', 'since', 'ignored' ],
		pageName: '404s',
	} );

	const { data, isFetching, refetch } = useErrorList( table );
	const { data: groupData } = useGroupDropdown();
	const remove = useErrorBulkAction();
	const create = useRedirectCreate();
	const rows: Error404[] = data?.items ?? [];
	const total = data?.total ?? 0;
	const pages = Math.max( 1, Math.ceil( total / table.per_page ) );

	const canFix = has_capability( CAP_REDIRECT_ADD );
	const canDelete = has_capability( CAP_404_DELETE );
	const filterBy: Record< string, string > = table.filterBy ?? {};
	const [ search, setSearch ] = useState( filterBy.url ?? '' );
	const [ fixing, setFixing ] = useState< string | null >( null );

	const setFilter = ( next: Record< string, string > ) => {
		setErrorsTable( { filterBy: next, groupBy: 'url', page: 0, selected: [], selectAll: false } );
	};

	const applySearch = useDebouncedCallback( ( value: string ) => {
		const { url: _url, ...rest } = filterBy;
		setFilter( value.trim() === '' ? rest : { ...rest, url: value.trim() } );
	}, SEARCH_DELAY );

	// Upstream's "ignore": a redirect that does nothing, which also stops the URL being logged again.
	const onIgnore = ( url: string ) => {
		const lastGroupId = Number( ( settings as { last_group_id?: number } | null )?.last_group_id ?? 0 );
		const state = createState( null, {
			url,
			groupId: pickDefaultGroup( groupData?.items ?? [], lastGroupId ),
			flags: { flag_regex: false, flag_trailing: false, flag_case: false, flag_query: 'exact' },
		} );

		create.mutate(
			{
				...toPayload( state ),
				action_type: ACTION_NOTHING,
				action_code: getCodeForActionType( ACTION_NOTHING ),
				action_data: {},
			},
			{ onSuccess: () => refetch() }
		);
	};

	const onDelete = ( url: string ) => {
		/* translators: %s: URL */
		if ( window.confirm( sprintf( __( 'Delete the 404 log for %s?', 'dsuite-redirects' ), url ) ) ) {
			remove.mutate( { action: 'delete', items: [ url ], params: { groupBy: 'url' } } );
		}
	};

	return (
		<div className="dsr-redirects">
			<div className="dsr-toolbar">
				<div className="dsr-search">
					<label className="screen-reader-text" htmlFor="dsr-404-search">
						{ __( 'Search 404s', 'dsuite-redirects' ) }
					</label>
					<input
						id="dsr-404-search"
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
					{ getChips().map( ( chip ) => (
						<button
							key={ chip.label }
							type="button"
							className="dsr-chip"
							aria-pressed={ sameFilter( filterBy, chip.filter ) }
							onClick={ () =>
								setFilter( { ...chip.filter, ...( filterBy.url ? { url: filterBy.url } : {} ) } )
							}
						>
							{ chip.label }
						</button>
					) ) }
				</div>
			</div>

			{ rows.length === 0 ? (
				<div className="dsr-empty">
					{ isFetching && ! data
						? __( 'Loading 404s…', 'dsuite-redirects' )
						: __( 'No 404s here. Nice.', 'dsuite-redirects' ) }
				</div>
			) : (
				<table className="dsr-table">
					<thead>
						<tr>
							<th>{ __( 'URL', 'dsuite-redirects' ) }</th>
							<th className="dsr-table__hits dsr-num">{ __( 'Hits', 'dsuite-redirects' ) }</th>
							<th className="dsr-table__last">{ __( 'Last seen', 'dsuite-redirects' ) }</th>
							<th className="dsr-table__actions">
								<span className="screen-reader-text">{ __( 'Actions', 'dsuite-redirects' ) }</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ rows.map( ( row ) => {
							const url = row.url ?? String( row.id );

							return (
								<tr key={ url }>
									<td className="dsr-table__redirect">
										<span className="dsr-table__source" title={ url }>
											{ url }
										</span>
										{ row.referrer && (
											<span className="dsr-table__target" title={ row.referrer }>
												{
													/* translators: %s: the page visitors came from */
													sprintf( __( 'from %s', 'dsuite-redirects' ), row.referrer )
												}
											</span>
										) }
									</td>
									<td
										className="dsr-table__hits dsr-num"
										data-label={ __( 'Hits', 'dsuite-redirects' ) }
									>
										{ row.count ?? 0 }
									</td>
									<td
										className="dsr-table__last"
										data-label={ __( 'Last seen', 'dsuite-redirects' ) }
									>
										{ row.last_seen ? row.last_seen.slice( 0, 16 ) : '–' }
									</td>
									<td className="dsr-table__actions">
										{ canFix && (
											<button
												type="button"
												className="dsr-link"
												onClick={ () => setFixing( url ) }
											>
												{ __( 'Fix', 'dsuite-redirects' ) }
											</button>
										) }
										{ canFix && filterBy.ignored !== '1' && (
											<button
												type="button"
												className="dsr-link"
												onClick={ () => onIgnore( url ) }
											>
												{ __( 'Ignore', 'dsuite-redirects' ) }
											</button>
										) }
										{ canDelete && (
											<button
												type="button"
												className="dsr-link dsr-link--danger"
												onClick={ () => onDelete( url ) }
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
						onClick={ () => setErrorsTable( { page: table.page - 1, selected: [] } ) }
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
						onClick={ () => setErrorsTable( { page: table.page + 1, selected: [] } ) }
					>
						{ __( 'Next', 'dsuite-redirects' ) }
					</Button>
				</nav>
			) }

			{ fixing !== null && (
				<RedirectDrawer item={ null } initialUrl={ fixing } onClose={ () => setFixing( null ) } />
			) }
		</div>
	);
}
