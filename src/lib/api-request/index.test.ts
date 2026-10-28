import { fetchRedirectLi, RedirectLiApi } from 'lib/api-request';

test( 'calls redirect.li without the REST nonce or cookies', async () => {
	window.Redirectioni10n = { ...window.Redirectioni10n, locale: 'en' } as typeof window.Redirectioni10n;
	const fetchMock = jest.fn().mockResolvedValue( { ok: true, json: () => Promise.resolve( { status: 'ok' } ) } );
	global.fetch = fetchMock;

	const result = await fetchRedirectLi( RedirectLiApi.http.get( 'https://example.com/' ) );
	const [ url, init ] = fetchMock.mock.calls[ 0 ];

	expect( result ).toEqual( { status: 'ok' } );
	expect( url ).toMatch( /^https:\/\/api\.redirect\.li\/v2\/http\?url=/ );
	expect( init.credentials ).toBe( 'omit' );
	expect( JSON.stringify( init ) ).not.toMatch( /nonce/i );
} );

test( 'rejects when redirect.li fails', async () => {
	global.fetch = jest.fn().mockResolvedValue( { ok: false, status: 502, statusText: 'Bad Gateway' } );

	await expect( fetchRedirectLi( RedirectLiApi.http.get( 'https://example.com/' ) ) ).rejects.toThrow( '502' );
} );

test( 'rejects an error reported in the body', async () => {
	global.fetch = jest
		.fn()
		.mockResolvedValue( { ok: true, json: () => Promise.resolve( { error: true, message: 'Bad URL' } ) } );

	await expect( fetchRedirectLi( RedirectLiApi.http.get( 'nope' ) ) ).rejects.toThrow( 'Bad URL' );
} );
