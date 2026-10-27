import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { buildHash, type RouteName } from 'app/router';

interface Card {
	title: string;
	body: string[];
	link?: { route: RouteName; label: string };
}

const HIDDEN_KEY = 'dsr_help_hidden';

// localStorage can throw (private mode, blocked storage); it only remembers a convenience.
function readHidden(): boolean {
	try {
		return window.localStorage.getItem( HIDDEN_KEY ) === '1';
	} catch {
		return false;
	}
}

function writeHidden( hidden: boolean ): void {
	try {
		window.localStorage.setItem( HIDDEN_KEY, hidden ? '1' : '0' );
	} catch {
		// Not persisted; the toggle still works for this visit.
	}
}

function getCards(): Card[] {
	return [
		{
			title: __( 'How a redirect works', 'dsuite-redirects' ),
			body: [
				__(
					'A redirect sends anyone who visits an old URL to a new one, so old links, bookmarks and search results keep working.',
					'dsuite-redirects'
				),
				__(
					'Permanent (301) tells search engines the page has moved for good and passes its ranking to the new URL. Use it for most changes. Temporary (302) keeps the old URL in search, for short campaigns. Gone (410) says the page was removed on purpose.',
					'dsuite-redirects'
				),
			],
			link: { route: 'redirects', label: __( 'Go to Redirects', 'dsuite-redirects' ) },
		},
		{
			title: __( 'Scheduling', 'dsuite-redirects' ),
			body: [
				__(
					'Turn on "Only active between dates" when you add or edit a redirect, then pick a start date, an end date, or both. Before it starts and after it ends, visitors see the old URL as if the redirect did not exist.',
					'dsuite-redirects'
				),
				__(
					'Use it for launches and seasonal offers. Redirects that end this week show here under Needs attention, with an Extend button.',
					'dsuite-redirects'
				),
			],
		},
		{
			title: __( 'Groups', 'dsuite-redirects' ),
			body: [
				__(
					'Groups are folders for redirects: one per campaign, site migration or section of the site. Filter the Redirects list by group to find them again.',
					'dsuite-redirects'
				),
				__(
					'Disabling a group switches off every redirect in it at once, which is handy when a campaign ends.',
					'dsuite-redirects'
				),
			],
			link: { route: 'groups', label: __( 'Go to Groups', 'dsuite-redirects' ) },
		},
		{
			title: __( 'Chains & loops', 'dsuite-redirects' ),
			body: [
				__(
					'A chain is a redirect that lands on another redirect (A → B → C). Each extra hop slows the page down and weakens SEO, so Flatten points A straight at C.',
					'dsuite-redirects'
				),
				__(
					'A loop sends visitors round in circles and they never arrive. Fix loops first: edit one of the redirects to point somewhere real.',
					'dsuite-redirects'
				),
			],
		},
	];
}

/**
 * Plain-language help for the marketing team. Open until someone hides it, then remembered per browser.
 */
export default function HelpCards() {
	const [ hidden, setHidden ] = useState( readHidden );

	const toggle = () => {
		writeHidden( ! hidden );
		setHidden( ! hidden );
	};

	return (
		<section className="dsr-help" aria-labelledby="dsr-help-title">
			<div className="dsr-help__header">
				<h2 id="dsr-help-title" className="dsr-section-title">
					{ __( 'How it works', 'dsuite-redirects' ) }
				</h2>
				<button
					type="button"
					className="dsr-link"
					aria-expanded={ ! hidden }
					aria-controls="dsr-help-cards"
					onClick={ toggle }
				>
					{ hidden ? __( 'Show', 'dsuite-redirects' ) : __( 'Hide', 'dsuite-redirects' ) }
				</button>
			</div>

			{ ! hidden && (
				<ul id="dsr-help-cards" className="dsr-help__cards">
					{ getCards().map( ( card ) => (
						<li key={ card.title } className="dsr-help__card">
							<h3 className="dsr-help__title">{ card.title }</h3>
							{ card.body.map( ( paragraph ) => (
								<p key={ paragraph }>{ paragraph }</p>
							) ) }
							{ card.link && (
								<a className="dsr-link" href={ buildHash( card.link.route ) }>
									{ card.link.label }
								</a>
							) }
						</li>
					) ) }
				</ul>
			) }
		</section>
	);
}
