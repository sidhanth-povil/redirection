import type { Redirect } from 'types';
import {
	applySimpleType,
	canSave,
	createState,
	getTarget,
	hasSingleTarget,
	pickDefaultGroup,
	scheduleError,
	setTarget,
	simpleTypeOf,
	toPayload,
} from './model';

const FLAGS = { flag_regex: false, flag_trailing: true, flag_case: true, flag_query: 'ignore' };

const urlRedirect: Redirect = {
	id: 4,
	url: '/old',
	match_type: 'url',
	action_type: 'url',
	action_code: 301,
	action_data: { url: '/new' },
	match_data: {
		source: { flag_regex: false, flag_trailing: false, flag_case: false, flag_query: 'exact' },
		options: {},
	},
	group_id: 2,
	title: 'Spring',
	position: 3,
};

const conditional: Redirect = {
	...urlRedirect,
	id: 9,
	url: '^/shop/(.*)$',
	match_type: 'login',
	action_type: 'url',
	action_code: 307,
	action_data: { logged_in: '/members/$1', logged_out: '/login' },
	match_data: {
		source: { flag_regex: true, flag_trailing: false, flag_case: true, flag_query: 'pass' },
		options: { log_exclude: true },
	},
};

describe( 'createState', () => {
	it( 'starts a new redirect from the defaults', () => {
		const state = createState( null, { url: '/from-404', groupId: 1, flags: FLAGS } );

		expect( state ).toMatchObject( {
			url: '/from-404',
			group_id: 1,
			match_type: 'url',
			action_type: 'url',
			action_code: 301,
			flag_case: true,
			flag_query: 'ignore',
		} );
		expect( getTarget( state ) ).toBe( '' );
	} );

	it( 'reads an existing redirect', () => {
		const state = createState( urlRedirect, { url: '', groupId: 1, flags: FLAGS } );

		expect( state ).toMatchObject( { url: '/old', title: 'Spring', group_id: 2, position: 3, flag_case: false } );
		expect( getTarget( state ) ).toBe( '/new' );
	} );
} );

describe( 'plain types', () => {
	const base = createState( null, { url: '/a', groupId: 1, flags: FLAGS } );

	it( 'maps codes to plain types', () => {
		expect( simpleTypeOf( base ) ).toBe( 'permanent' );
		expect( simpleTypeOf( applySimpleType( base, 'temporary' ) ) ).toBe( 'temporary' );
		expect( simpleTypeOf( applySimpleType( base, 'gone' ) ) ).toBe( 'gone' );
		expect( simpleTypeOf( { ...base, action_code: 307 } ) ).toBeNull();
		expect( simpleTypeOf( { ...base, action_type: 'pass', action_code: 200 } ) ).toBeNull();
		expect( simpleTypeOf( createState( conditional, { url: '', groupId: 1, flags: FLAGS } ) ) ).toBeNull();
	} );

	it( 'Gone is a 410 error and keeps the typed target for switching back', () => {
		const gone = applySimpleType( setTarget( base, '/new' ), 'gone' );

		expect( gone ).toMatchObject( { action_type: 'error', action_code: 410 } );
		expect( hasSingleTarget( gone ) ).toBe( false );
		expect( getTarget( applySimpleType( gone, 'permanent' ) ) ).toBe( '/new' );
	} );
} );

describe( 'canSave', () => {
	const base = createState( null, { url: '/a', groupId: 1, flags: FLAGS } );

	it( 'needs an old URL, a group and a destination for URL redirects', () => {
		expect( canSave( base ) ).toBe( false );
		expect( canSave( setTarget( base, '/b' ) ) ).toBe( true );
		expect( canSave( setTarget( { ...base, url: '  ' }, '/b' ) ) ).toBe( false );
		expect( canSave( setTarget( { ...base, group_id: 0 }, '/b' ) ) ).toBe( false );
	} );

	it( 'does not need a destination for Gone', () => {
		expect( canSave( applySimpleType( base, 'gone' ) ) ).toBe( true );
	} );
} );

describe( 'toPayload', () => {
	it( 'builds the REST payload with nested source flags', () => {
		const state = setTarget( createState( null, { url: ' /a ', groupId: 1, flags: FLAGS } ), '/b' );

		expect( toPayload( state ) ).toEqual( {
			url: '/a',
			title: '',
			match_type: 'url',
			action_type: 'url',
			action_code: 301,
			action_data: { url: '/b' },
			match_data: {
				source: { flag_regex: false, flag_trailing: true, flag_case: true, flag_query: 'ignore' },
				options: {},
			},
			group_id: 1,
			position: 0,
			start_at: null,
			end_at: null,
		} );
	} );

	it( 'round-trips a conditional redirect unchanged', () => {
		const payload = toPayload( createState( conditional, { url: '', groupId: 1, flags: FLAGS } ) );

		expect( payload ).toMatchObject( {
			url: conditional.url,
			match_type: 'login',
			action_type: 'url',
			action_code: 307,
			action_data: { logged_in: '/members/$1', logged_out: '/login' },
			match_data: conditional.match_data,
			group_id: 2,
			title: 'Spring',
			position: 3,
		} );
	} );
} );

describe( 'pickDefaultGroup', () => {
	const groups = [
		{ id: 2, name: 'Modified Posts' },
		{ id: 1, name: 'Redirections' },
		{ id: 5, name: 'Campaigns' },
	];

	it( 'prefers the last used group', () => {
		expect( pickDefaultGroup( groups, 5 ) ).toBe( 5 );
	} );

	it( 'falls back to the first group created, not the first listed', () => {
		expect( pickDefaultGroup( groups, 0 ) ).toBe( 1 );
		expect( pickDefaultGroup( groups, 99 ) ).toBe( 1 );
	} );

	it( 'returns 0 when there are no groups yet', () => {
		expect( pickDefaultGroup( [], 3 ) ).toBe( 0 );
	} );
} );

describe( 'schedule', () => {
	const base = setTarget( createState( null, { url: '/a', groupId: 1, flags: FLAGS } ), '/b' );

	it( 'reads the site-time part of the API dates for the date inputs', () => {
		const state = createState(
			{ ...urlRedirect, start_at: '2026-11-28T09:00:00+05:30', end_at: null },
			{ url: '', groupId: 1, flags: FLAGS }
		);

		expect( state.start_at ).toBe( '2026-11-28T09:00' );
		expect( state.end_at ).toBe( '' );
	} );

	it( 'sends empty dates as null and set dates as typed', () => {
		expect( toPayload( { ...base, start_at: '2026-11-28T09:00', end_at: '' } ) ).toMatchObject( {
			start_at: '2026-11-28T09:00',
			end_at: null,
		} );
	} );

	it( 'blocks an end that is not after the start', () => {
		const backwards = { ...base, start_at: '2026-12-02T09:00', end_at: '2026-11-28T09:00' };

		expect( scheduleError( backwards ) ).toMatch( /after the start/ );
		expect( canSave( backwards ) ).toBe( false );
		expect( scheduleError( { ...base, start_at: '2026-11-28T09:00', end_at: '2026-11-28T09:00' } ) ).not.toBeNull();
		expect( scheduleError( { ...base, start_at: '2026-11-28T09:00', end_at: '' } ) ).toBeNull();
		expect( canSave( { ...base, start_at: '2026-11-28T09:00', end_at: '2026-12-02T09:00' } ) ).toBe( true );
	} );
} );
