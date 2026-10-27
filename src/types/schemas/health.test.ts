import { TrafficResponseSchema } from 'types/schemas/health';

// Mirrors Health::route_traffic's JSON.
const traffic = {
	days: [
		{ date: '2026-10-26', redirects: 4, errors: 0 },
		{ date: '2026-10-27', redirects: 12, errors: 3 },
	],
	top: [
		{
			id: 9,
			hits: 12,
			redirect: {
				id: 9,
				url: '/old',
				match_type: 'url',
				action_type: 'url',
				action_code: 301,
				action_data: { url: '/new' },
				match_data: {
					source: { flag_regex: false, flag_trailing: false, flag_case: false, flag_query: 'exact' },
					options: {},
				},
				group_id: 1,
				title: '',
				position: 0,
				enabled: true,
				hits: 40,
			},
		},
	],
	retention: { redirect: 7, error: -1 },
};

test( 'parses the traffic response the API sends', () => {
	const parsed = TrafficResponseSchema.parse( traffic );

	expect( parsed.days[ 1 ] ).toEqual( { date: '2026-10-27', redirects: 12, errors: 3 } );
	expect( parsed.top[ 0 ].redirect.url ).toBe( '/old' );
	expect( parsed.retention.error ).toBe( -1 );
} );

test( 'rejects a day without counts', () => {
	expect( () => TrafficResponseSchema.parse( { ...traffic, days: [ { date: '2026-10-27' } ] } ) ).toThrow();
} );
