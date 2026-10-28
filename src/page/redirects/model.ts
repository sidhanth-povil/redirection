import { __ } from '@wordpress/i18n';
import {
	ACTION_ERROR,
	ACTION_URL,
	MATCH_URL,
	getMatchState,
	hasTargetData,
	hasUrlTarget,
} from 'lib/redirect-constants';
import type { CreateRedirectInput, Redirect } from 'types';

export type SimpleType = 'permanent' | 'temporary' | 'gone';

export interface SourceFlags {
	flag_regex: boolean;
	flag_trailing: boolean;
	flag_case: boolean;
	flag_query: string;
}

/** Same field names as upstream's editor state, so upstream field components can edit it directly. */
export interface DrawerState extends SourceFlags {
	url: string;
	title: string;
	match_type: string;
	action_type: string;
	action_code: number;
	action_data: Record< string, any >;
	options: Record< string, unknown >;
	group_id: number;
	position: number;
	/** `YYYY-MM-DDTHH:mm` in site time for the date inputs; '' = no limit. */
	start_at: string;
	end_at: string;
}

interface Defaults {
	url: string;
	target?: string;
	groupId: number;
	flags: SourceFlags;
}

const CODE_PERMANENT = 301;
const CODE_TEMPORARY = 302;
const CODE_GONE = 410;

export function createState( item: Redirect | null, defaults: Defaults ): DrawerState {
	if ( item === null ) {
		return {
			url: defaults.url,
			title: '',
			...defaults.flags,
			match_type: MATCH_URL,
			action_type: ACTION_URL,
			action_code: CODE_PERMANENT,
			action_data: { url: defaults.target ?? '' },
			options: {},
			group_id: defaults.groupId,
			position: 0,
			start_at: '',
			end_at: '',
		};
	}

	const source = item.match_data?.source;

	return {
		url: item.url,
		title: item.title,
		flag_regex: source?.flag_regex ?? false,
		flag_trailing: source?.flag_trailing ?? false,
		flag_case: source?.flag_case ?? false,
		flag_query: source?.flag_query ?? 'exact',
		match_type: item.match_type,
		action_type: item.action_type,
		action_code: item.action_code,
		action_data: getMatchState( item.match_type, item.action_data ),
		options: item.match_data?.options ?? {},
		group_id: item.group_id,
		position: item.position,
		start_at: toInputDate( item.start_at ),
		end_at: toInputDate( item.end_at ),
	};
}

// The API's ISO dates are already in site time, so the input value is the first 16 characters.
function toInputDate( iso: string | null | undefined ): string {
	return iso ? iso.slice( 0, 16 ) : '';
}

export function hasSchedule( state: DrawerState ): boolean {
	return state.start_at !== '' || state.end_at !== '';
}

/**
 * Same-format local strings compare chronologically.
 * @param state
 */
export function scheduleError( state: DrawerState ): string | null {
	if ( state.start_at !== '' && state.end_at !== '' && state.end_at <= state.start_at ) {
		return __( 'The end date must be after the start date.', 'dsuite-redirects' );
	}

	return null;
}

/**
 * The group a new redirect is filed in: the last one used (kept by the server in `last_group_id`),
 * otherwise the oldest group. The dropdown lists module groups first, so its first entry is not a safe default.
 *
 * @param groups      Groups from the dropdown endpoint.
 * @param lastGroupId Settings `last_group_id`, 0 when unset.
 */
export function pickDefaultGroup( groups: Array< { id: number } >, lastGroupId: number ): number {
	if ( groups.some( ( group ) => group.id === lastGroupId ) ) {
		return lastGroupId;
	}

	return groups.reduce( ( lowest, group ) => ( lowest === 0 || group.id < lowest ? group.id : lowest ), 0 );
}

export function simpleTypeOf( state: DrawerState ): SimpleType | null {
	if ( state.match_type !== MATCH_URL ) {
		return null;
	}

	if ( state.action_type === ACTION_URL && state.action_code === CODE_PERMANENT ) {
		return 'permanent';
	}

	if ( state.action_type === ACTION_URL && state.action_code === CODE_TEMPORARY ) {
		return 'temporary';
	}

	if ( state.action_type === ACTION_ERROR && state.action_code === CODE_GONE ) {
		return 'gone';
	}

	return null;
}

/**
 * action_data is left alone, so switching to Gone and back keeps the typed destination.
 * @param state
 * @param type
 */
export function applySimpleType( state: DrawerState, type: SimpleType ): DrawerState {
	if ( type === 'gone' ) {
		return { ...state, action_type: ACTION_ERROR, action_code: CODE_GONE };
	}

	return {
		...state,
		action_type: ACTION_URL,
		action_code: type === 'permanent' ? CODE_PERMANENT : CODE_TEMPORARY,
	};
}

/**
 * Mirrors the server's rule: a plain (non-regex) source containing `*` is saved as a wildcard.
 *
 * @param state Drawer state.
 */
export function isWildcard( state: DrawerState ): boolean {
	return ! state.flag_regex && state.url.includes( '*' );
}

/**
 * A plain "old URL → new URL" redirect, edited with the destination search box.
 * @param state
 */
export function hasSingleTarget( state: DrawerState ): boolean {
	return state.match_type === MATCH_URL && state.action_type === ACTION_URL;
}

export function getTarget( state: DrawerState ): string {
	return typeof state.action_data.url === 'string' ? state.action_data.url : '';
}

export function setTarget( state: DrawerState, url: string ): DrawerState {
	return { ...state, action_data: { ...state.action_data, url } };
}

/**
 * The redirect saved with a new target, exactly as the drawer would save it. Overview's Flatten uses it.
 *
 * @param item Stored redirect.
 * @param url  New target.
 */
export function withTarget( item: Redirect, url: string ): CreateRedirectInput {
	// Defaults only fill in a new redirect; createState reads everything else from the item.
	const defaults: Defaults = {
		url: item.url,
		groupId: item.group_id,
		flags: { flag_regex: false, flag_trailing: false, flag_case: false, flag_query: 'exact' },
	};

	return toPayload( setTarget( createState( item, defaults ), url ) );
}

export function canSave( state: DrawerState ): boolean {
	if ( state.url.trim() === '' || state.group_id <= 0 || scheduleError( state ) !== null ) {
		return false;
	}

	if ( hasSingleTarget( state ) ) {
		return getTarget( state ).trim() !== '';
	}

	if ( hasUrlTarget( state.action_type ) ) {
		return hasTargetData( state.match_type, state.action_data );
	}

	return true;
}

export function toPayload( state: DrawerState ): CreateRedirectInput {
	return {
		url: state.url.trim(),
		title: state.title,
		match_type: state.match_type,
		action_type: state.action_type,
		action_code: state.action_code,
		action_data: getMatchState( state.match_type, state.action_data ),
		match_data: {
			source: {
				flag_regex: state.flag_regex,
				flag_trailing: state.flag_trailing,
				flag_case: state.flag_case,
				flag_query: state.flag_query,
			},
			options: state.options,
		},
		group_id: state.group_id,
		position: state.position,
		start_at: state.start_at === '' ? null : state.start_at,
		end_at: state.end_at === '' ? null : state.end_at,
	};
}
