import { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { useRedirectList } from 'lib/api/hooks';
import { useMessageStore } from 'stores';
import RedirectDrawer from './redirect-drawer';

interface ExistingRedirectDrawerProps {
	id: number;
	onClose: () => void;
}

/**
 * Edit a redirect known only by its id, as a fixed 404 or a blocked duplicate knows it.
 *
 * @param props
 * @param props.id      Redirect id.
 * @param props.onClose Called when the drawer closes, or when the redirect no longer exists.
 */
export default function ExistingRedirectDrawer( { id, onClose }: ExistingRedirectDrawerProps ) {
	// The id filter returns at most one row; per_page stays at its default, as the route refuses fewer than 5.
	const { data, isFetching, isError } = useRedirectList( { page: 0, filterBy: { id: String( id ) } } );
	// The list keeps the previous query's rows while fetching, so match on the id.
	const item = data?.items.find( ( redirect ) => redirect.id === id );
	const isMissing = isError || ( ! isFetching && data !== undefined && item === undefined );
	// The notice re-renders the parent, handing a new onClose; report once, not on every render.
	const hasReported = useRef( false );

	useEffect( () => {
		if ( isMissing && ! hasReported.current ) {
			hasReported.current = true;
			useMessageStore.getState().addError( __( 'That redirect no longer exists.', 'dsuite-redirects' ) );
			onClose();
		}
	}, [ isMissing, onClose ] );

	return item ? <RedirectDrawer item={ item } onClose={ onClose } /> : null;
}
