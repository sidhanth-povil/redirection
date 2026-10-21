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
}

interface Defaults {
	url: string;
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
			action_data: { url: '' },
			options: {},
			group_id: defaults.groupId,
			position: 0,
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
	};
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

export function canSave( state: DrawerState ): boolean {
	if ( state.url.trim() === '' || state.group_id <= 0 ) {
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
	};
}
