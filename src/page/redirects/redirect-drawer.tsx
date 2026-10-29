import { useCallback, useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Badge, Button, Combobox, Drawer, Field, Segmented, type SegmentedOption } from 'ui';
import { useGroupDropdown, useRedirectCreate, useRedirectUpdate } from 'lib/api/hooks';
import { useSettingsStore } from 'stores';
import TableRow from 'component/redirect-edit/table-row';
import MatchType from 'component/redirect-edit/match-type';
import MatchTarget from 'component/redirect-edit/match';
import ActionType from 'component/redirect-edit/action-type';
import ActionCode from 'component/redirect-edit/action-code';
import ActionTarget from 'component/redirect-edit/action';
import { getWarningFromState } from 'component/redirect-edit/warning';
import { getSourceQuery } from 'component/redirect-edit/constants';
import { ACTION_URL, MATCH_LOGIN, MATCH_URL, getCodeForActionType, getMatchState } from 'lib/redirect-constants';
import type { Redirect } from 'types';
import {
	applySimpleType,
	canSave,
	createState,
	fallbackPayload,
	getTarget,
	hasSchedule,
	hasSingleTarget,
	isWildcard,
	pickDefaultGroup,
	scheduleError,
	setTarget,
	simpleTypeOf,
	toPayload,
	withTarget,
	type DrawerState,
	type SimpleType,
} from './model';
import { searchContent } from './search-content';
import Precheck, { RepointInbound, useSaveCheck } from './precheck';
import './style.scss';

const ADVANCED_KEY = 'dsr_advanced_open';

// localStorage can throw (private mode, blocked storage); it only remembers a convenience.
function readAdvancedOpen(): boolean {
	try {
		return window.localStorage.getItem( ADVANCED_KEY ) === '1';
	} catch {
		return false;
	}
}

function writeAdvancedOpen( open: boolean ): void {
	try {
		window.localStorage.setItem( ADVANCED_KEY, open ? '1' : '0' );
	} catch {
		// Not persisted; the section still works.
	}
}

function needsAdvanced( state: DrawerState ): boolean {
	return simpleTypeOf( state ) === null || state.flag_regex || state.match_type !== MATCH_URL;
}

const getTypeOptions = (): SegmentedOption< SimpleType >[] => [
	{
		value: 'permanent',
		label: __( 'Permanent', 'dsuite-redirects' ),
		hint: __( 'Page moved for good · 301', 'dsuite-redirects' ),
	},
	{
		value: 'temporary',
		label: __( 'Temporary', 'dsuite-redirects' ),
		hint: __( 'Campaign or short link · 302', 'dsuite-redirects' ),
	},
	{
		value: 'gone',
		label: __( 'Gone', 'dsuite-redirects' ),
		hint: __( 'Deleted for good · 410', 'dsuite-redirects' ),
	},
];

interface RedirectDrawerProps {
	item: Redirect | null;
	initialUrl?: string;
	initialTarget?: string;
	onClose: () => void;
}

export default function RedirectDrawer( { item, initialUrl = '', initialTarget = '', onClose }: RedirectDrawerProps ) {
	const { data: groupData } = useGroupDropdown();
	const groups = groupData?.items ?? [];
	const settings = useSettingsStore( ( store ) => store.values );
	// Not in the typed settings schema, but the server includes it in the preloaded settings.
	const lastGroupId = Number( ( settings as { last_group_id?: number } | null )?.last_group_id ?? 0 );
	// Errors are shown inside the drawer; the no-op stops the hooks also raising the page-wide error panel.
	const create = useRedirectCreate( { onError: () => {} } );
	const update = useRedirectUpdate( { onError: () => {} } );
	// Repointing reports its own failures page-wide: the drawer has already closed by then.
	const repointUpdate = useRedirectUpdate();
	const [ repoint, setRepoint ] = useState( true );
	const createFallback = useRedirectCreate();
	const [ fallback, setFallback ] = useState( '' );

	const [ state, setState ] = useState< DrawerState >( () =>
		createState( item, {
			url: initialUrl,
			target: initialTarget,
			groupId: pickDefaultGroup( groups, lastGroupId ),
			flags: {
				flag_regex: Boolean( settings?.flag_regex ),
				flag_trailing: Boolean( settings?.flag_trailing ),
				flag_case: Boolean( settings?.flag_case ),
				flag_query: settings?.flag_query ?? 'pass',
			},
		} )
	);
	const [ touched, setTouched ] = useState( false );
	const [ scheduleOn, setScheduleOn ] = useState( () => hasSchedule( state ) );
	const [ advancedOpen, setAdvancedOpen ] = useState( () => readAdvancedOpen() || needsAdvanced( state ) );

	// Groups may arrive after the drawer opens; file a new redirect in the default group.
	const defaultGroupId = pickDefaultGroup( groups, lastGroupId );
	useEffect( () => {
		if ( state.group_id <= 0 && defaultGroupId > 0 ) {
			setState( ( prev ) => ( { ...prev, group_id: defaultGroupId } ) );
		}
	}, [ state.group_id, defaultGroupId ] );

	const hasError = Boolean( create.error || update.error );
	const { reset: resetCreate } = create;
	const { reset: resetUpdate } = update;
	const change = useCallback(
		( next: ( prev: DrawerState ) => DrawerState ) => {
			setTouched( true );
			setState( next );

			// A save error describes the values that were sent; once they change it no longer applies.
			if ( hasError ) {
				resetCreate();
				resetUpdate();
			}
		},
		[ hasError, resetCreate, resetUpdate ]
	);

	const formId = useId();
	const sourceId = useId();
	const targetId = useId();
	const groupId = useId();
	const titleId = useId();
	const positionId = useId();
	const queryId = useId();
	const scheduleId = useId();
	const startId = useId();
	const endId = useId();
	const fallbackId = useId();
	const rangeError = scheduleError( state );
	const timezone = window.Redirectioni10n?.timezone || 'UTC';

	const saving = create.isPending || update.isPending;
	const check = useSaveCheck( state, item?.id ?? 0 );
	// A scheduled redirect isn't always live, so repointing others at its target would bypass the schedule.
	const inbound = hasSchedule( state ) ? [] : check.result?.inbound ?? [];
	// Through a chain, straight to its end; otherwise to this redirect's own target.
	const repointTarget = check.result?.final_target ?? getTarget( state ).trim();
	const isSaveable = canSave( state ) && ! check.isBlocked;
	const error = ( item ? update.error : create.error )?.message;
	const simpleType = simpleTypeOf( state );
	// Upstream warns that `*` looks like regex; for a wildcard that advice is wrong, so check the source without its stars.
	const warnings = getWarningFromState(
		isWildcard( state ) ? { ...state, url: state.url.replace( /\*/g, '' ) } : state
	);

	const requestClose = useCallback( () => {
		if ( touched && ! window.confirm( __( 'Discard your changes?', 'dsuite-redirects' ) ) ) {
			return;
		}

		onClose();
	}, [ touched, onClose ] );

	const onSave = ( event: FormEvent ) => {
		event.preventDefault();

		if ( ! isSaveable || saving ) {
			return;
		}

		const payload = toPayload( state );
		// Without dates the redirect is always live and the fallback could never match.
		const fallbackUrl = hasSchedule( state ) && ! item ? fallback.trim() : '';
		const hasFollowUps = ( repoint && inbound.length > 0 ) || fallbackUrl !== '';
		// Follow-ups report their own failures page-wide; the drawer closes once they have all finished.
		const onSuccess = hasFollowUps
			? () =>
					Promise.allSettled( [
						...( repoint ? repointInbound() : [] ),
						...( fallbackUrl !== ''
							? [ createFallback.mutateAsync( fallbackPayload( state, fallbackUrl ) ) ]
							: [] ),
					] ).finally( onClose )
			: onClose;

		if ( item ) {
			update.mutate( { id: item.id, ...payload }, { onSuccess } );
		} else {
			create.mutate( payload, { onSuccess } );
		}
	};

	// Each is saved as Flatten saves one, through the usual update route; one failing doesn't stop the rest.
	const repointInbound = () =>
		inbound.map( ( redirect ) =>
			repointUpdate.mutateAsync( { id: redirect.id, ...withTarget( redirect, repointTarget ) } )
		);

	// Upstream field components emit change events named after the state keys.
	const onChangeRule = ( event: ChangeEvent< HTMLSelectElement > ) => {
		const { name, value } = event.target;

		change( ( prev ) => {
			if ( name === 'match_type' ) {
				return {
					...prev,
					match_type: value,
					action_data: getMatchState( value, prev.action_data ),
					...( value === MATCH_LOGIN ? { action_type: ACTION_URL } : {} ),
				};
			}

			if ( name === 'action_type' ) {
				return {
					...prev,
					action_type: value,
					action_code: getCodeForActionType( value ),
					action_data: getMatchState( prev.match_type, prev.action_data ),
				};
			}

			if ( name === 'action_code' ) {
				return { ...prev, action_code: parseInt( value, 10 ) };
			}

			return prev;
		} );
	};

	const onChangeActionData = ( event: ChangeEvent< HTMLInputElement > ) => {
		const { name, type, checked, value } = event.target;

		change( ( prev ) => ( {
			...prev,
			action_data: { ...prev.action_data, [ name ]: type === 'checkbox' ? checked : value },
		} ) );
	};

	const onToggleFlag = ( event: ChangeEvent< HTMLInputElement > ) => {
		const { name, checked } = event.target;

		change( ( prev ) => ( { ...prev, [ name ]: checked } ) );
	};

	return (
		<Drawer
			open
			title={ item ? __( 'Edit redirect', 'dsuite-redirects' ) : __( 'New redirect', 'dsuite-redirects' ) }
			onClose={ requestClose }
			footer={
				<>
					<Button onClick={ requestClose }>{ __( 'Cancel', 'dsuite-redirects' ) }</Button>
					<Button variant="primary" type="submit" form={ formId } disabled={ ! isSaveable || saving }>
						{ saving ? __( 'Saving…', 'dsuite-redirects' ) : __( 'Save redirect', 'dsuite-redirects' ) }
					</Button>
				</>
			}
		>
			<form id={ formId } className="dsr-redirect-form" onSubmit={ onSave } noValidate>
				{ error && (
					<div className="dsr-notice dsr-notice--error" role="alert">
						{ error }
					</div>
				) }

				<Field
					label={ __( 'Old URL', 'dsuite-redirects' ) }
					htmlFor={ sourceId }
					hint={ __(
						'The address people visit now, for example /summer-sale. Use * to match everything under a path, for example /blog/*',
						'dsuite-redirects'
					) }
				>
					<div className="dsr-input-group">
						<span className="dsr-input-group__prefix" aria-hidden="true">
							{ window.location.host }
						</span>
						<input
							id={ sourceId }
							className="dsr-input"
							value={ state.url }
							placeholder="/old-page"
							autoComplete="off"
							// react-focus-lock moves focus here when the drawer opens.
							data-autofocus
							aria-describedby={ `${ sourceId }-hint` }
							onChange={ ( event ) => {
								const url = event.target.value;
								change( ( prev ) => ( { ...prev, url } ) );
							} }
						/>
					</div>
				</Field>

				{ isWildcard( state ) && (
					<p className="dsr-wildcard-note">
						<Badge tone="accent">{ __( 'Wildcard', 'dsuite-redirects' ) }</Badge>
						{ __(
							'Matches everything where the * is. Put * in "Send visitors to" to carry that part over, for example /news/*',
							'dsuite-redirects'
						) }
					</p>
				) }

				{ hasSingleTarget( state ) && (
					<Field
						label={ __( 'Send visitors to', 'dsuite-redirects' ) }
						htmlFor={ targetId }
						hint={ __( 'Search for a page or post by title, or type any URL', 'dsuite-redirects' ) }
					>
						<Combobox
							id={ targetId }
							value={ getTarget( state ) }
							search={ searchContent }
							placeholder="/new-page"
							describedBy={ `${ targetId }-hint` }
							onChange={ ( url ) => change( ( prev ) => setTarget( prev, url ) ) }
						/>
					</Field>
				) }

				{ check.result && (
					<Precheck
						result={ check.result }
						onUseTarget={ ( url ) => change( ( prev ) => setTarget( prev, url ) ) }
					/>
				) }

				{ inbound.length > 0 && (
					<RepointInbound
						inbound={ inbound }
						target={ repointTarget }
						checked={ repoint }
						onChange={ setRepoint }
					/>
				) }

				<Segmented
					label={ __( 'Type', 'dsuite-redirects' ) }
					options={ getTypeOptions() }
					value={ simpleType }
					// Plain types only describe plain URL matches; conditional redirects change type under Advanced.
					disabled={ state.match_type !== MATCH_URL }
					onChange={ ( type ) =>
						state.match_type === MATCH_URL && change( ( prev ) => applySimpleType( prev, type ) )
					}
				/>
				{ simpleType === null && (
					<p className="dsr-hint">
						{ __( 'This redirect uses a custom action. Change it under Advanced.', 'dsuite-redirects' ) }
					</p>
				) }

				<Field
					label={ __( 'Purpose', 'dsuite-redirects' ) }
					htmlFor={ groupId }
					hint={ __(
						'Why this redirect exists, so whoever tidies up later knows if it is still needed.',
						'dsuite-redirects'
					) }
				>
					<select
						id={ groupId }
						className="dsr-select"
						aria-describedby={ `${ groupId }-hint` }
						value={ state.group_id }
						onChange={ ( event ) => {
							const group_id = parseInt( event.target.value, 10 );
							change( ( prev ) => ( { ...prev, group_id } ) );
						} }
					>
						{ groups.map( ( group ) => (
							<option key={ group.id } value={ group.id }>
								{ group.name }
							</option>
						) ) }
					</select>
				</Field>

				<div className="dsr-schedule">
					<label className="dsr-switch" htmlFor={ scheduleId }>
						<input
							id={ scheduleId }
							type="checkbox"
							role="switch"
							className="dsr-switch__input"
							checked={ scheduleOn }
							onChange={ ( event ) => {
								const on = event.target.checked;
								setScheduleOn( on );

								if ( ! on ) {
									change( ( prev ) => ( { ...prev, start_at: '', end_at: '' } ) );
								}
							} }
						/>
						<span className="dsr-switch__track" aria-hidden="true" />
						{ __( 'Only active between dates', 'dsuite-redirects' ) }
					</label>

					{ scheduleOn && (
						<>
							<div className="dsr-schedule__dates">
								<Field label={ __( 'Starts', 'dsuite-redirects' ) } htmlFor={ startId }>
									<input
										id={ startId }
										type="datetime-local"
										className="dsr-input"
										value={ state.start_at }
										onChange={ ( event ) => {
											const start_at = event.target.value;
											change( ( prev ) => ( { ...prev, start_at } ) );
										} }
									/>
								</Field>
								<Field label={ __( 'Ends', 'dsuite-redirects' ) } htmlFor={ endId }>
									<input
										id={ endId }
										type="datetime-local"
										className="dsr-input"
										value={ state.end_at }
										onChange={ ( event ) => {
											const end_at = event.target.value;
											change( ( prev ) => ( { ...prev, end_at } ) );
										} }
									/>
								</Field>
							</div>
							{ ! item && (
								<Field
									label={ __( "When it isn't live, send visitors to", 'dsuite-redirects' ) }
									htmlFor={ fallbackId }
								>
									<input
										id={ fallbackId }
										type="text"
										className="dsr-input"
										placeholder={ __( 'Optional, e.g. /deals/', 'dsuite-redirects' ) }
										value={ fallback }
										onChange={ ( event ) => {
											setTouched( true );
											setFallback( event.target.value );
										} }
									/>
								</Field>
							) }
							{ rangeError ? (
								<p className="dsr-field-error" role="alert">
									{ rangeError }
								</p>
							) : (
								<p className="dsr-hint">
									{ sprintf(
										/* translators: %s: site timezone, e.g. Europe/London */
										__(
											'Times are in the site timezone (%s). Leave a date empty for no limit. The redirect switches on and off by itself.',
											'dsuite-redirects'
										),
										timezone
									) }
								</p>
							) }
						</>
					) }
				</div>

				{ warnings.length > 0 && (
					<div className="dsr-notice dsr-notice--warning">
						{ warnings.map( ( warning, index ) => (
							<p key={ index }>{ warning }</p>
						) ) }
					</div>
				) }

				<details
					className="dsr-advanced"
					open={ advancedOpen }
					onToggle={ ( event ) => {
						const open = event.currentTarget.open;

						// Browsers also fire toggle for the initial open attribute; only remember user changes.
						if ( open === advancedOpen ) {
							return;
						}

						setAdvancedOpen( open );
						writeAdvancedOpen( open );
					} }
				>
					<summary className="dsr-advanced__summary">
						{ __( 'Advanced', 'dsuite-redirects' ) }
						<span className="dsr-advanced__hint">
							{ __( 'regex, conditions, group, title, position', 'dsuite-redirects' ) }
						</span>
					</summary>

					<div className="dsr-advanced__body">
						<div className="dsr-advanced__grid">
							<Field label={ __( 'Position', 'dsuite-redirects' ) } htmlFor={ positionId }>
								<input
									id={ positionId }
									type="number"
									min={ 0 }
									className="dsr-input"
									value={ state.position }
									onChange={ ( event ) => {
										const position = Math.max( 0, parseInt( event.target.value, 10 ) || 0 );
										change( ( prev ) => ( { ...prev, position } ) );
									} }
								/>
							</Field>
						</div>

						<Field label={ __( 'Title', 'dsuite-redirects' ) } htmlFor={ titleId }>
							<input
								id={ titleId }
								className="dsr-input"
								value={ state.title }
								onChange={ ( event ) => {
									const title = event.target.value;
									change( ( prev ) => ( { ...prev, title } ) );
								} }
							/>
						</Field>

						<fieldset className="dsr-checks">
							<legend className="dsr-label">{ __( 'Matching', 'dsuite-redirects' ) }</legend>
							<label className="dsr-check" htmlFor={ `${ formId }-flag_regex` }>
								<input
									id={ `${ formId }-flag_regex` }
									type="checkbox"
									name="flag_regex"
									checked={ state.flag_regex }
									onChange={ onToggleFlag }
								/>
								{ __( 'Regular expression', 'dsuite-redirects' ) }
							</label>
							<label className="dsr-check" htmlFor={ `${ formId }-flag_case` }>
								<input
									id={ `${ formId }-flag_case` }
									type="checkbox"
									name="flag_case"
									checked={ state.flag_case }
									onChange={ onToggleFlag }
								/>
								{ __( 'Ignore case', 'dsuite-redirects' ) }
							</label>
							<label className="dsr-check" htmlFor={ `${ formId }-flag_trailing` }>
								<input
									id={ `${ formId }-flag_trailing` }
									type="checkbox"
									name="flag_trailing"
									checked={ state.flag_trailing }
									onChange={ onToggleFlag }
								/>
								{ __( 'Ignore trailing slash', 'dsuite-redirects' ) }
							</label>
							<Field label={ __( 'Query parameters', 'dsuite-redirects' ) } htmlFor={ queryId }>
								<select
									id={ queryId }
									className="dsr-select"
									value={ state.flag_query }
									onChange={ ( event ) => {
										const flag_query = event.target.value;
										change( ( prev ) => ( { ...prev, flag_query } ) );
									} }
								>
									{ getSourceQuery().map( ( option ) => (
										<option key={ option.value } value={ option.value }>
											{ option.label }
										</option>
									) ) }
								</select>
							</Field>
						</fieldset>

						<table className="dsr-advanced-table">
							<tbody>
								<MatchType matchType={ state.match_type } onChange={ onChangeRule } />
								<MatchTarget
									matchType={ state.match_type }
									actionData={ state.action_data }
									onChange={ onChangeActionData as any }
								/>
								<TableRow title={ __( 'When matched', 'dsuite-redirects' ) }>
									<ActionType
										actionType={ state.action_type }
										matchType={ state.match_type }
										onChange={ onChangeRule }
									/>
									<ActionCode
										actionType={ state.action_type }
										actionCode={ state.action_code }
										onChange={ onChangeRule }
									/>
								</TableRow>
								{ ! hasSingleTarget( state ) && (
									<ActionTarget
										actionType={ state.action_type }
										matchType={ state.match_type }
										actionData={ state.action_data }
										onChange={ onChangeActionData as any }
									/>
								) }
							</tbody>
						</table>
					</div>
				</details>
			</form>
		</Drawer>
	);
}
