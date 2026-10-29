import { useId } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useDebounce } from 'use-debounce';
import { useRedirectCheck } from 'lib/api/hooks';
import { MATCH_URL } from 'lib/redirect-constants';
import { buildHash } from 'app/router';
import { Button } from 'ui';
import type { CheckResponse, Redirect } from 'types';
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

	// A second plain redirect for the same old URL never runs: the first one always matches.
	return { result, isBlocked: result?.status === 'loop' || result?.status === 'duplicate' };
}

interface PrecheckProps {
	result: CheckResponse;
	onUseTarget: ( url: string ) => void;
}

export default function Precheck( { result, onUseTarget }: PrecheckProps ) {
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
			// No final target: the destination leads into a loop elsewhere. Worth knowing, but not this redirect's fault.
			if ( result.final_target === undefined ) {
				return (
					<div className="dsr-notice dsr-notice--warning" role="status">
						<p>
							{ sprintf(
								/* translators: %s: the redirects visitors pass through, e.g. /a → /b → /a */
								__(
									'The destination already loops: %s. Fix that loop from Overview.',
									'dsuite-redirects'
								),
								path
							) }
						</p>
					</div>
				);
			}

			const finalTarget = result.final_target;

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
				<div className="dsr-notice dsr-notice--error" role="alert">
					<p>
						{ __(
							'Another redirect already uses this old URL, so this one would never run. Change that one instead.',
							'dsuite-redirects'
						) }{ ' ' }
						<a href={ buildHash( 'redirects', { edit: String( result.existing_id ?? 0 ) } ) }>
							{ __( 'Edit that redirect', 'dsuite-redirects' ) }
						</a>
					</p>
				</div>
			);
	}
}

const MAX_LISTED = 5;

interface RepointProps {
	inbound: Redirect[];
	target: string;
	checked: boolean;
	onChange: ( checked: boolean ) => void;
}

/**
 * Redirects that point at this redirect's old URL would reach the page through it. Offer to send them straight on.
 *
 * @param props
 * @param props.inbound  Redirects whose target is this source.
 * @param props.target   Where they would be sent.
 * @param props.checked  Repoint on save.
 * @param props.onChange Toggle.
 */
export function RepointInbound( { inbound, target, checked, onChange }: RepointProps ) {
	const hidden = inbound.length - MAX_LISTED;
	const checkId = useId();

	return (
		<div className="dsr-notice dsr-repoint">
			<label className="dsr-check" htmlFor={ checkId }>
				<input
					id={ checkId }
					type="checkbox"
					checked={ checked }
					onChange={ ( event ) => onChange( event.target.checked ) }
				/>
				{ sprintf(
					/* translators: 1: number of redirects, 2: destination URL */
					_n(
						'Also point %1$d redirect that leads here straight to %2$s',
						'Also point %1$d redirects that lead here straight to %2$s',
						inbound.length,
						'dsuite-redirects'
					),
					inbound.length,
					target
				) }
			</label>
			<ul className="dsr-repoint__list">
				{ inbound.slice( 0, MAX_LISTED ).map( ( redirect ) => (
					<li key={ redirect.id }>
						<code>{ redirect.url }</code>
					</li>
				) ) }
				{ hidden > 0 && (
					<li>
						{
							/* translators: %d: number of redirects not listed */
							sprintf( __( 'and %d more', 'dsuite-redirects' ), hidden )
						}
					</li>
				) }
			</ul>
		</div>
	);
}
