import { useId, useState, type FormEvent } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useRedirectTrace } from 'lib/api/hooks';
import type { TraceResult } from 'types';
import './style.scss';

/**
 * Follows an address on this site hop by hop, from the server. The browser's own cache can hide a changed 301;
 * this sees what a new visitor gets. Nothing is sent to an outside service.
 */
function HttpTester() {
	const inputId = useId();
	const trace = useRedirectTrace();
	const [ url, setUrl ] = useState( '' );
	const [ result, setResult ] = useState< TraceResult | null >( null );
	const [ error, setError ] = useState( '' );

	const submit = ( event: FormEvent ) => {
		event.preventDefault();
		if ( url.trim() === '' ) {
			return;
		}

		trace.mutate( url.trim(), {
			onSuccess: ( data ) => {
				setResult( data );
				setError( '' );
			},
			onError: ( failure ) => {
				setResult( null );
				setError( failure.message );
			},
		} );
	};

	return (
		<form className="http-tester dsr-tracer" onSubmit={ submit }>
			<h3>{ __( 'Redirect tester', 'dsuite-redirects' ) }</h3>
			<p>
				{ __(
					'Your browser can remember an old redirect. This asks your server instead, and follows every hop a new visitor would take.',
					'dsuite-redirects'
				) }
			</p>

			<div className="redirection-httptest__input">
				<label htmlFor={ inputId }>{ __( 'Address on this site', 'dsuite-redirects' ) }</label>
				<input
					id={ inputId }
					className="regular-text"
					type="text"
					value={ url }
					onChange={ ( event ) => setUrl( event.target.value ) }
					placeholder={ __( '/old-page or the full address', 'dsuite-redirects' ) }
				/>
				<input
					type="submit"
					className="button-secondary"
					disabled={ url.trim() === '' || trace.isPending }
					value={
						trace.isPending ? __( 'Checking…', 'dsuite-redirects' ) : __( 'Check', 'dsuite-redirects' )
					}
				/>
			</div>

			{ error && (
				<p className="dsr-tracer__error" role="alert">
					{ error }
				</p>
			) }

			{ result && <TraceSteps result={ result } /> }
		</form>
	);
}

function TraceSteps( { result }: { result: TraceResult } ) {
	const redirects = result.hops.filter( ( hop ) => hop.code >= 300 && hop.code < 400 ).length;
	const last = result.hops[ result.hops.length - 1 ];

	return (
		<div className="dsr-tracer__result">
			<ol className="dsr-tracer__hops">
				{ result.hops.map( ( hop, index ) => (
					<li key={ `${ hop.url }-${ index }` }>
						<code>{ hop.url }</code>
						<span className="dsr-tracer__code">{ hop.code }</span>
						{ hop.location && <span className="dsr-tracer__to">→ { hop.location }</span> }
					</li>
				) ) }
			</ol>

			{ result.loop && (
				<p className="dsr-tracer__error" role="alert">
					{ __( 'These redirects go round in a loop.', 'dsuite-redirects' ) }
				</p>
			) }
			{ ! result.loop && last?.external && (
				<p>{ __( 'Goes to another site, which is not checked.', 'dsuite-redirects' ) }</p>
			) }
			{ ! result.loop && ! last?.external && redirects > 0 && (
				<p>
					{ sprintf(
						/* translators: %d: number of redirects */
						_n(
							'%d redirect before the page loads.',
							'%d redirects before the page loads.',
							redirects,
							'dsuite-redirects'
						),
						redirects
					) }
				</p>
			) }
		</div>
	);
}

export default HttpTester;
