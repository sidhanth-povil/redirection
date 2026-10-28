import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { buildHash, type RouteName } from 'app/router';

interface Card {
	title: string;
	body: string[];
	link?: { route: RouteName; label: string };
}

interface Section {
	id: string;
	title: string;
	cards: Card[];
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

// Start here is for someone opening the plugin for the first time on a site that is already set up.
function getStartCards(): Card[] {
	return [
		{
			title: __( 'Find your way around', 'dsuite-redirects' ),
			body: [
				__(
					'Overview shows what needs attention and how much traffic your redirects get. Redirects lists every redirect: search by old URL or destination, or filter by group.',
					'dsuite-redirects'
				),
				__(
					'404s lists addresses visitors tried that do not exist. Logs lists each redirected visit. Import / Export is for working with many redirects at once.',
					'dsuite-redirects'
				),
			],
		},
		{
			title: __( 'Add a redirect', 'dsuite-redirects' ),
			body: [
				__(
					'On Redirects, choose Add redirect. In Old URL, type the address people still use, starting with / (for example /summer-sale). In "Send visitors to", search for the page by its title or paste any URL.',
					'dsuite-redirects'
				),
				__(
					'Leave Type on Permanent unless the move is temporary, then Save redirect. If another redirect already uses that old URL, the form tells you.',
					'dsuite-redirects'
				),
			],
			link: { route: 'redirects', label: __( 'Go to Redirects', 'dsuite-redirects' ) },
		},
		{
			title: __( 'Campaign links with UTM tags', 'dsuite-redirects' ),
			body: [
				__(
					'Out of the box a redirect matches its old URL exactly, so /summer-sale?utm_source=newsletter is not redirected.',
					'dsuite-redirects'
				),
				__(
					'For an old URL used in ads, emails or social posts, open Advanced and set Query parameters to "Ignore & pass parameters to the target". Visitors are redirected and the tags go with them, so analytics still sees the campaign.',
					'dsuite-redirects'
				),
			],
		},
		{
			title: __( 'Fix 404s', 'dsuite-redirects' ),
			body: [
				__(
					'404s lists addresses that do not exist on the site and how often they were tried. Start with New this week and the most hit ones.',
					'dsuite-redirects'
				),
				__(
					'Fix opens a new redirect with the old URL filled in: choose where visitors should go. Ignore is for junk such as bots probing for files; it hides the address from the list.',
					'dsuite-redirects'
				),
			],
			link: { route: '404s', label: __( 'Go to 404s', 'dsuite-redirects' ) },
		},
		{
			title: __( 'Check a redirect works', 'dsuite-redirects' ),
			body: [
				__(
					'Open the old URL in a private window. Browsers remember permanent redirects, so a normal window can show an old result after you change one.',
					'dsuite-redirects'
				),
				__(
					'Hits and Last hit on Redirects show when a redirect was used. The Redirect Tester on Support checks any URL and shows where it goes.',
					'dsuite-redirects'
				),
			],
			link: { route: 'support', label: __( 'Open the Redirect Tester', 'dsuite-redirects' ) },
		},
	];
}

function getMoreCards(): Card[] {
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
		},
		{
			title: __( 'Move a whole section', 'dsuite-redirects' ),
			body: [
				__(
					'One wildcard redirect covers every page in a section. Old URL /old-blog/* with "Send visitors to" /blog/* sends /old-blog/any-post to /blog/any-post.',
					'dsuite-redirects'
				),
				__(
					'Without a * in "Send visitors to", every page in the section goes to that one address.',
					'dsuite-redirects'
				),
			],
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
					'Disabling a group switches off every redirect in it at once, which is handy when a campaign ends. Enabling it again switches all of them back on, including any that were switched off one by one.',
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
		{
			title: __( 'A page changed its address', 'dsuite-redirects' ),
			body: [
				__(
					'Changing a page or post URL in WordPress can break links to the old address. Add a redirect from the old URL to the new one.',
					'dsuite-redirects'
				),
				__(
					'If an admin has turned on URL Monitor in Settings, this happens on its own for the content types they chose, and the redirects appear in the group they picked.',
					'dsuite-redirects'
				),
			],
		},
		{
			title: __( 'Many redirects at once', 'dsuite-redirects' ),
			body: [
				__(
					'Import / Export takes a CSV file with one redirect per row: the old URL in the first column and the new URL in the second. Check the preview before you import.',
					'dsuite-redirects'
				),
				__( 'Export CSV on Redirects downloads the list for a spreadsheet or a backup.', 'dsuite-redirects' ),
			],
			link: { route: 'import-export', label: __( 'Go to Import / Export', 'dsuite-redirects' ) },
		},
	];
}

function getSections(): Section[] {
	return [
		{ id: 'dsr-help-start', title: __( 'Start here', 'dsuite-redirects' ), cards: getStartCards() },
		{ id: 'dsr-help-more', title: __( 'Good to know', 'dsuite-redirects' ), cards: getMoreCards() },
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
				<div id="dsr-help-cards" className="dsr-help__sections">
					{ getSections().map( ( section ) => (
						<section key={ section.id } aria-labelledby={ section.id }>
							<h3 id={ section.id } className="dsr-help__group">
								{ section.title }
							</h3>
							<ul className="dsr-help__cards">
								{ section.cards.map( ( card ) => (
									<li key={ card.title } className="dsr-help__card">
										<h4 className="dsr-help__title">{ card.title }</h4>
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
						</section>
					) ) }
				</div>
			) }
		</section>
	);
}
