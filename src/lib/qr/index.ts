import qrcode from 'qrcode-generator';

// Medium error correction survives a scuffed print; 8px cells give a 200–300px image that scales cleanly as SVG.
const CELL_SIZE = 8;
const QUIET_ZONE = 4;

/**
 * A standalone SVG QR code for a short link, for flyers, booths and social bios.
 *
 * @param url Full URL to encode.
 */
export function qrSvg( url: string ): string {
	const code = qrcode( 0, 'M' );

	try {
		code.addData( toAscii( url ) );
		code.make();
	} catch {
		// The library throws a bare string past the largest code size (about 2,300 characters at this level).
		throw new Error( 'This address is too long for a QR code.' );
	}

	return code.createSvgTag( CELL_SIZE, QUIET_ZONE );
}

/**
 * The library writes one byte per character, so non-ASCII must be percent-escaped first, as a browser would send it.
 *
 * @param url Full URL.
 */
function toAscii( url: string ): string {
	try {
		return new URL( url ).href;
	} catch {
		return encodeURI( url );
	}
}

/**
 * @param path Old URL, e.g. /brochure.
 */
export function qrFilename( path: string ): string {
	const slug = path
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^-+|-+$/g, '' );

	return `qr-${ slug || 'home' }.svg`;
}

/**
 * Save the QR code for a URL as an SVG file.
 *
 * @param url  Full URL to encode.
 * @param path Old URL, used for the file name.
 */
export function downloadQr( url: string, path: string ): void {
	const blob = new Blob( [ qrSvg( url ) ], { type: 'image/svg+xml' } );
	const href = window.URL.createObjectURL( blob );
	const link = document.createElement( 'a' );

	link.href = href;
	link.download = qrFilename( path );
	document.body.appendChild( link );
	link.click();
	link.remove();
	window.URL.revokeObjectURL( href );
}
