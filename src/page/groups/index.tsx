import { useState } from 'react';
import type { FormEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { useGroupBulkAction, useGroupCreate, useGroupList, useGroupUpdate } from 'lib/api/hooks';
import { useTableUrlSync } from 'lib/hooks';
import { getModuleName, getModules } from 'lib/modules';
import { has_capability, CAP_GROUP_ADD, CAP_GROUP_DELETE, CAP_REDIRECT_MANAGE } from 'lib/capabilities';
import { useTableStore } from 'stores';
import { buildHash } from 'app/router';
import { Badge, Button } from 'ui';
// Shared list styles (.dsr-table, .dsr-toolbar, …).
import '../redirects/style.scss';
import type { Group } from 'types';

const APACHE_MODULE = 2;

interface ModuleSelectProps {
	id: string;
	value: number;
	onChange: ( moduleId: number ) => void;
}

function ModuleSelect( { id, value, onChange }: ModuleSelectProps ) {
	return (
		<>
			<label className="screen-reader-text" htmlFor={ id }>
				{ __( 'Module', 'dsuite-redirects' ) }
			</label>
			<select
				id={ id }
				className="dsr-select"
				value={ value }
				onChange={ ( event ) => onChange( parseInt( event.target.value, 10 ) ) }
			>
				{ getModules().map( ( module ) => (
					<option key={ module.value } value={ module.value }>
						{ module.label }
					</option>
				) ) }
			</select>
		</>
	);
}

function ApacheNote( { moduleId }: { moduleId: number } ) {
	return moduleId === APACHE_MODULE ? (
		<p className="dsr-hint">
			{ __(
				'Note that you will need to set the Apache module path in your DSuite Redirects options.',
				'dsuite-redirects'
			) }
		</p>
	) : null;
}

function AddGroup() {
	const [ name, setName ] = useState( '' );
	const [ moduleId, setModuleId ] = useState( 1 );
	const create = useGroupCreate();

	const onSubmit = ( event: FormEvent ) => {
		event.preventDefault();
		create.mutate( { name: name.trim(), moduleId, position: 0 } );
		setName( '' );
	};

	return (
		<form className="dsr-toolbar" onSubmit={ onSubmit }>
			<div className="dsr-search">
				<label className="screen-reader-text" htmlFor="dsr-group-new">
					{ __( 'New group name', 'dsuite-redirects' ) }
				</label>
				<input
					id="dsr-group-new"
					type="text"
					className="dsr-input"
					placeholder={ __( 'New group name', 'dsuite-redirects' ) }
					value={ name }
					onChange={ ( event ) => setName( event.target.value ) }
				/>
			</div>
			<ModuleSelect id="dsr-group-new-module" value={ moduleId } onChange={ setModuleId } />
			<Button type="submit" variant="primary" disabled={ name.trim() === '' }>
				{ __( 'Add group', 'dsuite-redirects' ) }
			</Button>
			<ApacheNote moduleId={ moduleId } />
		</form>
	);
}

interface EditRowProps {
	group: Group;
	onDone: () => void;
}

function EditRow( { group, onDone }: EditRowProps ) {
	const [ name, setName ] = useState( group.name );
	const [ moduleId, setModuleId ] = useState( group.module_id );
	const update = useGroupUpdate();

	const onSubmit = ( event: FormEvent ) => {
		event.preventDefault();
		update.mutate( { id: group.id, name: name.trim(), moduleId } );
		onDone();
	};

	return (
		<tr>
			<td colSpan={ 4 }>
				<form className="dsr-toolbar" onSubmit={ onSubmit }>
					<div className="dsr-search">
						<label className="screen-reader-text" htmlFor={ `dsr-group-${ group.id }` }>
							{ __( 'Group name', 'dsuite-redirects' ) }
						</label>
						<input
							id={ `dsr-group-${ group.id }` }
							type="text"
							className="dsr-input"
							value={ name }
							onChange={ ( event ) => setName( event.target.value ) }
						/>
					</div>
					<ModuleSelect id={ `dsr-group-${ group.id }-module` } value={ moduleId } onChange={ setModuleId } />
					<Button type="submit" variant="primary" disabled={ name.trim() === '' }>
						{ __( 'Save', 'dsuite-redirects' ) }
					</Button>
					<Button onClick={ onDone }>{ __( 'Cancel', 'dsuite-redirects' ) }</Button>
					<ApacheNote moduleId={ moduleId } />
				</form>
			</td>
		</tr>
	);
}

export default function Groups() {
	const table = useTableStore( ( store ) => store.groups );
	const { setGroupsTable } = useTableStore();

	useTableUrlSync( {
		table,
		setTable: setGroupsTable,
		allowedOrder: [ 'name', 'id' ],
		allowedFilters: [ 'name', 'status', 'module' ],
		defaultOrder: 'name',
		pageName: 'groups',
	} );

	const { data, isFetching } = useGroupList( table );
	const bulk = useGroupBulkAction();
	const rows: Group[] = data?.items ?? [];
	const total = data?.total ?? 0;
	const pages = Math.max( 1, Math.ceil( total / table.per_page ) );
	const [ editing, setEditing ] = useState< number | null >( null );

	const canEdit = has_capability( CAP_GROUP_ADD );
	const canDelete = has_capability( CAP_GROUP_DELETE );
	const canViewRedirects = has_capability( CAP_REDIRECT_MANAGE );

	const onDelete = ( group: Group ) => {
		/* translators: %s: group name */
		const message = sprintf( __( 'Delete the group %s and its redirects?', 'dsuite-redirects' ), group.name );

		if ( window.confirm( message ) ) {
			bulk.mutate( { action: 'delete', items: [ group.id ] } );
		}
	};

	return (
		<div className="dsr-redirects">
			{ canEdit && <AddGroup /> }

			{ rows.length === 0 ? (
				<div className="dsr-empty">
					{ isFetching && ! data
						? __( 'Loading groups…', 'dsuite-redirects' )
						: __( 'No groups yet.', 'dsuite-redirects' ) }
				</div>
			) : (
				<table className="dsr-table">
					<thead>
						<tr>
							<th>{ __( 'Group', 'dsuite-redirects' ) }</th>
							<th className="dsr-table__type">{ __( 'Module', 'dsuite-redirects' ) }</th>
							<th className="dsr-table__hits dsr-num">{ __( 'Redirects', 'dsuite-redirects' ) }</th>
							<th className="dsr-table__actions">
								<span className="screen-reader-text">{ __( 'Actions', 'dsuite-redirects' ) }</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ rows.map( ( group ) =>
							editing === group.id ? (
								<EditRow key={ group.id } group={ group } onDone={ () => setEditing( null ) } />
							) : (
								<tr key={ group.id } className={ group.enabled ? undefined : 'is-disabled' }>
									<td className="dsr-table__redirect">
										<span className="dsr-table__source" title={ group.name }>
											{ group.name }
										</span>
									</td>
									<td className="dsr-table__type">
										<span className="dsr-table__badges">
											<Badge tone="info">{ getModuleName( group.module_id ) }</Badge>
											{ ! group.enabled && (
												<Badge tone="neutral">{ __( 'Disabled', 'dsuite-redirects' ) }</Badge>
											) }
										</span>
									</td>
									<td
										className="dsr-table__hits dsr-num"
										data-label={ __( 'Redirects', 'dsuite-redirects' ) }
									>
										{ group.redirects }
									</td>
									<td className="dsr-table__actions">
										{ canViewRedirects && (
											<a
												className="dsr-link"
												href={ buildHash( 'redirects', {
													'filterby[group]': String( group.id ),
												} ) }
											>
												{ __( 'View redirects', 'dsuite-redirects' ) }
											</a>
										) }
										{ canEdit && (
											<button
												type="button"
												className="dsr-link"
												onClick={ () => setEditing( group.id ) }
											>
												{ __( 'Edit', 'dsuite-redirects' ) }
											</button>
										) }
										{ canEdit && (
											<button
												type="button"
												className="dsr-link"
												onClick={ () =>
													bulk.mutate( {
														action: group.enabled ? 'disable' : 'enable',
														items: [ group.id ],
													} )
												}
											>
												{ group.enabled
													? __( 'Disable', 'dsuite-redirects' )
													: __( 'Enable', 'dsuite-redirects' ) }
											</button>
										) }
										{ canDelete && (
											<button
												type="button"
												className="dsr-link dsr-link--danger"
												onClick={ () => onDelete( group ) }
											>
												{ __( 'Delete', 'dsuite-redirects' ) }
											</button>
										) }
									</td>
								</tr>
							)
						) }
					</tbody>
				</table>
			) }

			{ pages > 1 && (
				<nav className="dsr-pagination" aria-label={ __( 'Pagination', 'dsuite-redirects' ) }>
					<Button disabled={ table.page === 0 } onClick={ () => setGroupsTable( { page: table.page - 1 } ) }>
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
						onClick={ () => setGroupsTable( { page: table.page + 1 } ) }
					>
						{ __( 'Next', 'dsuite-redirects' ) }
					</Button>
				</nav>
			) }
		</div>
	);
}
