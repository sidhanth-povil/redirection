import { qrFilename, qrSvg } from './index';

describe( 'qrSvg', () => {
	it( 'makes a standalone SVG for the URL', () => {
		const svg = qrSvg( 'https://example.com/brochure' );

		expect( svg.startsWith( '<svg' ) ).toBe( true );
		expect( svg ).toContain( 'xmlns="http://www.w3.org/2000/svg"' );
		expect( qrSvg( 'https://example.com/brochure' ) ).toBe( svg );
		expect( qrSvg( 'https://example.com/other' ) ).not.toBe( svg );
	} );
} );

describe( 'qrFilename', () => {
	it( 'names the file after the short link', () => {
		expect( qrFilename( '/brochure' ) ).toBe( 'qr-brochure.svg' );
		expect( qrFilename( '/spring/Offer 2026/' ) ).toBe( 'qr-spring-offer-2026.svg' );
		expect( qrFilename( '/' ) ).toBe( 'qr-home.svg' );
	} );
} );
