import { useCallback, useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useDebouncedCallback } from 'use-debounce';
import { useExport, useGroupDropdown, useRedirectBulkAction, useRedirectDelete, useRedirectList } from 'lib/api/hooks';
import { cleanApiParams } from 'lib/api/utils';
import { useTableStore } from 'stores';
import { useTableUrlSync } from 'lib/hooks';
import { has_capability, CAP_REDIRECT_ADD, CAP_REDIRECT_DELETE } from 'lib/capabilities';
import { getExportFilename } from 'page/export/export-helpers';
import { buildHash, useRoute } from 'app/router';
import { Button } from 'ui';
import type { Redirect } from 'types';
import RedirectTable from './redirect-table';
import RedirectDrawer from './redirect-drawer';
import './style.scss';

type SearchField = 'url' | 'target' | 'title';
type BulkAction = 'enable' | 'disable' | 'delete' | 'export';

const SEARCH_FIELDS: SearchField[] = [ 'url', 'target', 'title' ];
const SEARCH_DELAY = 300;

interface DrawerTarget {
	item: Redirect | null;
	url: string;
}

interface StatusChip {
	label: string;
	status: string;
	schedule: string;
}

const getStatusChips = (): StatusChip[] => [
	{ label: __( 'All', 'dsuite-redirects' ), status: '', schedule: '' },
	{ label: __( 'Live', 'dsuite-redirects' ), status: 'enabled', schedule: 'live' },
	{ label: __( 'Scheduled', 'dsuite-redirects' ), status: '', schedule: 'scheduled' },
	{ label: __( 'Expired', 'dsuite-redirects' ), status: '', schedule: 'expired' },
	{ label: __( 'Disabled', 'dsuite-redirects' ), status: 'disabled', schedule: '' },
];

export default function Redirects() {
	const table = useTableStore( ( store ) => store.redirects );
	const addTop = useTableStore( ( store ) => store.redirectsAddTop );
	const { setRedirectsTable, setRedirectsAddTop } = useTableStore();

	useTableUrlSync( {
		table,
		setTable: setRedirectsTable,
		allowedOrder: [ 'id', 'url', 'last_access', 'last_count', 'position' ],
		allowedFilters: [ 'url', 'target', 'title', 'group', 'status', 'schedule', 'id' ],
		defaultOrder: 'id',
		pageName: 'redirect',
	} );

	const { data, isLoading } = useRedirectList( table );
	const { data: groupData } = useGroupDropdown();
	const groups = groupData?.items ?? [];
	const rows = data?.items ?? [];
	const total = data?.total ?? 0;

	const remove = useRedirectDelete();
	const enable = useRedirectBulkAction( 'enable' );
	const disable = useRedirectBulkAction( 'disable' );
	const exportRedirects = useExport();

	const canAdd = has_capability( CAP_REDIRECT_ADD );
	const canDelete = has_capability( CAP_REDIRECT_DELETE );

	const [ drawer, setDrawer ] = useState< DrawerTarget | null >( null );
	const route = useRoute();

	// The header's "Add redirect" button.
	useEffect( () => {
		if ( addTop ) {
			setDrawer( { item: null, url: '' } );
			setRedirectsAddTop( false );
		}
	}, [ addTop, setRedirectsAddTop ] );

	// Deep link used by 404 emails and other pages: #/redirects?new=1&from=/old-url
	const { new: isNew, from } = route.query;
	useEffect( () => {
		if ( isNew === '1' && canAdd ) {
			setDrawer( { item: null, url: from ?? '' } );
			window.history.replaceState( {}, '', buildHash( 'redirects' ) );
		}
	}, [ isNew, from, canAdd ] );

	const filterBy: Record< string, string > = table.filterBy ?? {};
	const [ field, setField ] = useState< SearchField >(
		() => SEARCH_FIELDS.find( ( name ) => filterBy[ name ] ) ?? 'url'
	);
	const [ search, setSearch ] = useState( () => filterBy[ field ] ?? '' );

	const setFilter = useCallback(
		( next: Record< string, string > ) => {
			const merged: Record< string, string > = {};

			Object.entries( { ...( table.filterBy ?? {} ), ...next } ).forEach( ( [ key, value ] ) => {
				if ( value !== '' ) {
					merged[ key ] = value;
				}
			} );

			setRedirectsTable( { filterBy: merged, page: 0, selected: [], selectAll: false } );
		},
		[ table.filterBy, setRedirectsTable ]
	);

	const applySearch = useDebouncedCallback( ( value: string, onField: SearchField ) => {
		setFilter( { url: '', target: '', title: '', [ onField ]: value.trim() } );
	}, SEARCH_DELAY );

	const selected = table.selected.filter( ( id ): id is number => typeof id === 'number' );
	const clearSelection = () => setRedirectsTable( { selected: [], selectAll: false } );

	const runBulk = ( action: BulkAction ) => {
		if ( selected.length === 0 ) {
			return;
		}

		if ( action === 'delete' ) {
			const message = sprintf(
				/* translators: %d: number of redirects */
				_n( 'Delete %d redirect?', 'Delete %d redirects?', selected.length, 'dsuite-redirects' ),
				selected.length
			);

			if ( ! window.confirm( message ) ) {
				return;
			}

			remove.mutate( { items: selected } );
		} else if ( action === 'enable' ) {
			enable.mutate( { items: selected } );
		} else if ( action === 'disable' ) {
			disable.mutate( { items: selected } );
		} else {
			exportRedirects.mutate( {
				exportType: 'redirect',
				format: 'csv',
				download: true,
				copy: false,
				filename: getExportFilename( 'redirect', 'csv' ),
				completionNotice: { message: __( 'Export downloaded', 'dsuite-redirects' ) },
				params: cleanApiParams( { items: selected } ),
			} as any );
		}

		clearSelection();
	};

	const onDeleteRow = ( row: Redirect ) => {
		/* translators: %s: old URL */
		if ( window.confirm( sprintf( __( 'Delete the redirect for %s?', 'dsuite-redirects' ), row.url ) ) ) {
			remove.mutate( { items: [ row.id ] } );
		}
	};

	const hasFilters = Object.keys( filterBy ).length > 0;
	const pages = Math.max( 1, Math.ceil( total / table.per_page ) );

	const empty = hasFilters ? (
		<>
			<p>{ __( 'No redirects match these filters.', 'dsuite-redirects' ) }</p>
			<Button
				onClick={ () => {
					setSearch( '' );
					setRedirectsTable( { filterBy: {}, page: 0 } );
				} }
			>
				{ __( 'Clear filters', 'dsuite-redirects' ) }
			</Button>
		</>
	) : (
		<>
			<p>{ __( 'No redirects yet. Send an old address to a new page in a few seconds.', 'dsuite-redirects' ) }</p>
			{ canAdd && (
				<Button variant="primary" onClick={ () => setDrawer( { item: null, url: '' } ) }>
					{ __( 'Add your first redirect', 'dsuite-redirects' ) }
				</Button>
			) }
		</>
	);

	return (
		<div className="dsr-redirects">
			<div className="dsr-toolbar">
				<div className="dsr-search">
					<label className="screen-reader-text" htmlFor="dsr-redirect-search">
						{ __( 'Search redirects', 'dsuite-redirects' ) }
					</label>
					<input
						id="dsr-redirect-search"
						type="search"
						className="dsr-input"
						placeholder={ __( 'Search redirects…', 'dsuite-redirects' ) }
						value={ search }
						onChange={ ( event ) => {
							setSearch( event.target.value );
							applySearch( event.target.value, field );
						} }
					/>
					<label className="screen-reader-text" htmlFor="dsr-redirect-search-field">
						{ __( 'Search in', 'dsuite-redirects' ) }
					</label>
					<select
						id="dsr-redirect-search-field"
						className="dsr-select"
						value={ field }
						onChange={ ( event ) => {
							const next = event.target.value as SearchField;
							setField( next );
							applySearch( search, next );
						} }
					>
						<option value="url">{ __( 'Old URL', 'dsuite-redirects' ) }</option>
						<option value="target">{ __( 'Destination', 'dsuite-redirects' ) }</option>
						<option value="title">{ __( 'Title', 'dsuite-redirects' ) }</option>
					</select>
				</div>

				<div className="dsr-chips" role="group" aria-label={ __( 'Status', 'dsuite-redirects' ) }>
					{ getStatusChips().map( ( chip ) => (
						<button
							key={ chip.label }
							type="button"
							className="dsr-chip"
							aria-pressed={
								( filterBy.status ?? '' ) === chip.status &&
								( filterBy.schedule ?? '' ) === chip.schedule
							}
							onClick={ () => setFilter( { status: chip.status, schedule: chip.schedule } ) }
						>
							{ chip.label }
						</button>
					) ) }
				</div>

				{ groups.length > 1 && (
					<select
						className="dsr-select"
						aria-label={ __( 'Group', 'dsuite-redirects' ) }
						value={ filterBy.group ?? '' }
						onChange={ ( event ) => setFilter( { group: event.target.value } ) }
					>
						<option value="">{ __( 'All groups', 'dsuite-redirects' ) }</option>
						{ groups.map( ( group ) => (
							<option key={ group.id } value={ String( group.id ) }>
								{ group.name }
							</option>
						) ) }
					</select>
				) }
			</div>

			{ selected.length > 0 && (
				<div className="dsr-bulkbar" role="region" aria-label={ __( 'Bulk actions', 'dsuite-redirects' ) }>
					<span className="dsr-bulkbar__count">
						{ sprintf(
							/* translators: %d: number of selected redirects */
							_n( '%d selected', '%d selected', selected.length, 'dsuite-redirects' ),
							selected.length
						) }
					</span>
					{ canAdd && (
						<Button onClick={ () => runBulk( 'enable' ) }>{ __( 'Enable', 'dsuite-redirects' ) }</Button>
					) }
					{ canAdd && (
						<Button onClick={ () => runBulk( 'disable' ) }>{ __( 'Disable', 'dsuite-redirects' ) }</Button>
					) }
					<Button onClick={ () => runBulk( 'export' ) }>{ __( 'Export CSV', 'dsuite-redirects' ) }</Button>
					{ canDelete && (
						<Button onClick={ () => runBulk( 'delete' ) }>{ __( 'Delete', 'dsuite-redirects' ) }</Button>
					) }
					<button type="button" className="dsr-link" onClick={ clearSelection }>
						{ __( 'Clear', 'dsuite-redirects' ) }
					</button>
				</div>
			) }

			<RedirectTable
				rows={ rows }
				loading={ isLoading && ! data }
				selected={ selected }
				canEdit={ canAdd }
				canDelete={ canDelete }
				empty={ empty }
				onSelect={ ( ids ) => setRedirectsTable( { selected: ids, selectAll: false } ) }
				onEdit={ ( row ) => setDrawer( { item: row, url: '' } ) }
				onToggle={ ( row ) => ( row.enabled === false ? enable : disable ).mutate( { items: [ row.id ] } ) }
				onDelete={ onDeleteRow }
			/>

			{ pages > 1 && (
				<nav className="dsr-pagination" aria-label={ __( 'Pagination', 'dsuite-redirects' ) }>
					<Button
						disabled={ table.page === 0 }
						onClick={ () => setRedirectsTable( { page: table.page - 1, selected: [] } ) }
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
						onClick={ () => setRedirectsTable( { page: table.page + 1, selected: [] } ) }
					>
						{ __( 'Next', 'dsuite-redirects' ) }
					</Button>
				</nav>
			) }

			{ drawer && (
				<RedirectDrawer
					key={ drawer.item?.id ?? 'new' }
					item={ drawer.item }
					initialUrl={ drawer.url }
					onClose={ () => setDrawer( null ) }
				/>
			) }
		</div>
	);
}
