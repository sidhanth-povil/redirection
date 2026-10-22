import { __, sprintf } from '@wordpress/i18n';
import { useDebounce } from 'use-debounce';
import { useRedirectCheck } from 'lib/api/hooks';
import { MATCH_URL } from 'lib/redirect-constants';
import { buildHash } from 'app/router';
import { Button } from 'ui';
import type { CheckResponse } from 'types';
import { getTarget, hasSingleTarget, isWildcard, type DrawerState } from './model';

const CHECK_DELAY = 400;

/**
 * Check the redirect for chains, loops and duplicates once typing pauses. Only plain URL redirects are checked;
 * the server can't follow wildcards or regex.
 *
 * @param state Drawer state.
 * @param id    Redirect being edited, 0 for a new one.
 */
export function useSaveCheck(
	state: DrawerState,
	id: number
): { result: CheckResponse | undefined; isBlocked: boolean } {
	const source = state.url.trim();
	const target = getTarget( state ).trim();
	const [ debouncedSource ] = useDebounce( source, CHECK_DELAY );
	const [ debouncedTarget ] = useDebounce( target, CHECK_DELAY );
	const isCheckable =
		state.match_type === MATCH_URL &&
		hasSingleTarget( state ) &&
		! state.flag_regex &&
		! isWildcard( state ) &&
		source !== '' &&
		target !== '';
	// A result for older input would describe a redirect that is no longer on screen.
	const isSettled = debouncedSource === source && debouncedTarget === target;
	const { data, isPlaceholderData } = useRedirectCheck(
		{ source: debouncedSource, target: debouncedTarget, id },
		isCheckable && isSettled
	);
	const result = isCheckable && isSettled && ! isPlaceholderData ? data : undefined;

	return { result, isBlocked: result?.status === 'loop' };
}

interface PrecheckProps {
	result: CheckResponse;
	source: string;
	onUseTarget: ( url: string ) => void;
}

export default function Precheck( { result, source, onUseTarget }: PrecheckProps ) {
	const path = ( result.path ?? [] ).join( ' → ' );

	switch ( result.status ) {
		case 'ok':
			return (
				<p className="dsr-precheck" role="status">
					{ __( 'No chains or loops.', 'dsuite-redirects' ) }
				</p>
			);

		case 'loop':
			return (
				<div className="dsr-notice dsr-notice--error" role="alert">
					<p>
						{ sprintf(
							/* translators: %s: the redirects in the loop, e.g. /a → /b → /a */
							__(
								'This would send visitors round in a loop: %s. Change the destination to save.',
								'dsuite-redirects'
							),
							path
						) }
					</p>
				</div>
			);

		case 'chain': {
			const finalTarget = result.final_target ?? '';

			return (
				<div className="dsr-notice dsr-notice--warning" role="status">
					<p>
						{ sprintf(
							/* translators: %s: the redirects visitors pass through, e.g. /a → /b → /c */
							__( 'Visitors would pass through more than one redirect: %s.', 'dsuite-redirects' ),
							path
						) }
					</p>
					<Button onClick={ () => onUseTarget( finalTarget ) }>
						{
							/* translators: %s: final destination URL */
							sprintf( __( 'Point straight to %s', 'dsuite-redirects' ), finalTarget )
						}
					</Button>
				</div>
			);
		}

		case 'duplicate':
			return (
				<div className="dsr-notice dsr-notice--warning" role="status">
					<p>
						{ __( 'Another redirect already uses this old URL.', 'dsuite-redirects' ) }{ ' ' }
						{ /* A new tab keeps what's typed here. */ }
						<a
							href={ buildHash( 'redirects', { 'filterby[url]': source } ) }
							target="_blank"
							rel="noreferrer"
						>
							{ __( 'View it', 'dsuite-redirects' ) }
						</a>
					</p>
				</div>
			);
	}
}
