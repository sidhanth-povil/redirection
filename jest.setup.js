const { configure } = require( '@testing-library/react' );

// Async UI (debounced checks, Headless UI menus, query retries) waits on timers. On a loaded machine the 1s default
// for findBy/waitFor runs out before the UI settles, failing tests that pass on an idle one.
configure( { asyncUtilTimeout: 5000 } );
