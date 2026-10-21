import { createRoot } from 'react-dom/client';

import App from './app';
import { legacyUrlToHashUrl } from 'app/router';

function show( dom: string ) {
	const element = document.getElementById( dom );

	if ( element ) {
		const root = createRoot( element );
		root.render( <App /> );
	}
}

// Old `?sub=` links become hash routes before the app reads the URL.
const hashUrl = legacyUrlToHashUrl( window.location.href );
if ( hashUrl ) {
	window.history.replaceState( null, '', hashUrl );
}

if ( document.querySelector( '#dsr-app' ) && window.Redirectioni10n ) {
	show( 'dsr-app' );
	window.redirection = window.Redirectioni10n.version;
}
