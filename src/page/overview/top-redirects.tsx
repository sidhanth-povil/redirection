import { __ } from '@wordpress/i18n';
import type { Redirect, TrafficResponse } from 'types';
import { describeTarget } from 'page/redirects/describe';

interface TopRedirectsProps {
	top: TrafficResponse[ 'top' ] | undefined;
	onOpen: ( redirect: Redirect ) => void;
}

/**
 * The old URLs that still bring visitors in, most used first: the ones worth keeping and checking.
 * @param root0
 * @param root0.top
 * @param root0.onOpen
 */
export default function TopRedirects( { top, onOpen }: TopRedirectsProps ) {
	const body = () => {
		if ( ! top ) {
			return <p className="dsr-empty">{ __( 'Loading…', 'dsuite-redirects' ) }</p>;
		}

		if ( top.length === 0 ) {
			return (
				<div className="dsr-empty">{ __( 'No redirects were used in this range.', 'dsuite-redirects' ) }</div>
			);
		}

		return (
			<ul className="dsr-attention__list">
				{ top.map( ( { id, hits, redirect } ) => (
					<li key={ id } className="dsr-attention__item">
						<div className="dsr-attention__text">
							<button
								type="button"
								className="dsr-link dsr-attention__title"
								title={ redirect.url }
								onClick={ () => onOpen( redirect ) }
							>
								{ redirect.url }
							</button>
							<span className="dsr-attention__meta">→ { describeTarget( redirect ) }</span>
						</div>
						<span className="dsr-top__hits">{ hits }</span>
					</li>
				) ) }
			</ul>
		);
	};

	return (
		<section className="dsr-attention" aria-labelledby="dsr-top-title">
			<h2 id="dsr-top-title" className="dsr-section-title">
				{ __( 'Top redirects', 'dsuite-redirects' ) }
			</h2>
			{ body() }
		</section>
	);
}
