import type { Redirect } from 'types';
import { describeTarget, typeBadge } from './describe';

const row = ( overrides: Partial< Redirect > ): Redirect => ( {
	id: 1,
	url: '/old',
	match_type: 'url',
	action_type: 'url',
	action_code: 301,
	action_data: { url: '/new' },
	group_id: 1,
	title: '',
	position: 0,
	...overrides,
} );

describe( 'describeTarget', () => {
	it( 'shows the destination of a URL redirect', () => {
		expect( describeTarget( row( {} ) ) ).toBe( '/new' );
	} );

	it( 'describes other actions in words', () => {
		expect( describeTarget( row( { action_type: 'error', action_code: 410 } ) ) ).toBe( 'Gone (410)' );
		expect( describeTarget( row( { action_type: 'error', action_code: 404 } ) ) ).toBe( 'Error page (404)' );
		expect( describeTarget( row( { action_type: 'pass', action_code: 200, action_data: { url: '/x' } } ) ) ).toBe(
			'Pass-through to /x'
		);
		expect( describeTarget( row( { action_type: 'random' } ) ) ).toBe( 'Random post' );
		expect( describeTarget( row( { action_type: 'nothing' } ) ) ).toBe( 'Do nothing (log only)' );
		expect( describeTarget( row( { match_type: 'login', action_data: { logged_in: '/a' } } ) ) ).toBe(
			'Depends on login status'
		);
		expect( describeTarget( row( { match_type: 'referrer', action_data: { referrer: 'x' } } ) ) ).toBe(
			'Conditional redirect'
		);
	} );
} );

describe( 'typeBadge', () => {
	it( 'names the common codes', () => {
		expect( typeBadge( row( {} ) ) ).toEqual( { tone: 'success', label: 'Permanent', code: 301 } );
		expect( typeBadge( row( { action_code: 302 } ) ) ).toEqual( { tone: 'info', label: 'Temporary', code: 302 } );
		expect( typeBadge( row( { action_type: 'error', action_code: 410 } ) ) ).toEqual( {
			tone: 'danger',
			label: 'Gone',
			code: 410,
		} );
		expect( typeBadge( row( { action_code: 307 } ) ) ).toEqual( { tone: 'neutral', label: '307', code: 307 } );
	} );
} );
