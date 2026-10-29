import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The plugin runs on client sites, so admin pages must not send addresses, visitor IPs or user agents to an outside
 * service. redirect.li (upstream's lookup service) was removed; this keeps it from coming back.
 */

const ROOT = join( __dirname, '..', '..', '..' );
const BLOCKED_HOSTS = [ 'redirect.li' ];
// The host as a whole word: `api.redirect.li/v1` is caught, `RedirectionApi.redirect.list` is not.
const blocked = BLOCKED_HOSTS.map( ( host ) => new RegExp( `(^|[^\\w])${ host.replace( /\./g, '\\.' ) }(?![\\w])` ) );
const SOURCE = /\.(tsx?|jsx?|php)$/;

function sourceFiles( dir: string ): string[] {
	return readdirSync( dir ).flatMap( ( name ) => {
		const path = join( dir, name );

		if ( statSync( path ).isDirectory() ) {
			return sourceFiles( path );
		}

		return SOURCE.test( name ) && path !== __filename ? [ path ] : [];
	} );
}

test( 'no source file calls a third-party lookup service', () => {
	const offenders = [ 'src', 'includes' ]
		.flatMap( ( dir ) => sourceFiles( join( ROOT, dir ) ) )
		.filter( ( file ) => {
			const text = readFileSync( file, 'utf8' );
			return blocked.some( ( pattern ) => pattern.test( text ) );
		} );

	expect( offenders ).toEqual( [] );
} );
