=== DSuite Redirects ===
Contributors: johnny5
Tags: redirect, htaccess, 301, 404, apache
Tested up to: 7.1
Stable tag: 1.4.0
License: GPLv3

Redirect manager for marketing teams, by DSuite. Based on Redirection by John Godley.

== Description ==

DSuite Redirects is the redirect manager built by [DSuite](https://designsuite.ai) for marketing teams. Add and schedule redirects, catch broken links before visitors and search engines do, and see at a glance which redirects are working.

It is based on Redirection by John Godley, so it keeps Redirection's proven redirect engine and your existing Redirection data, with a simpler interface on top.

DSuite Redirects is compatible with PHP from 7.4 to 8.5.

= Overview =

The Overview page shows redirected visits and 404s per day for the last 7 or 30 days, your most used redirects, and how many redirects have had no hits in a year. Help cards explain the basics for new team members.

= Redirects =

Add a redirect in one form: type where visitors come from, then search your posts and pages for where they should go, or type any URL. Before you save, the form warns about chains, loops and duplicates and offers a one-click fix.

Use a wildcard to move a whole section of your site in one redirect, or regular expressions when you need full control. Query parameters can be matched exactly, ignored, or passed through to the target, which keeps campaign UTM tags working.

When a post or page changes its address, a redirect from the old address can be created automatically. When a published post, page or custom post is trashed or deleted, a card offers to redirect its old address.

= Scheduled campaign redirects =

Give a redirect a start date, an end date, or both. It switches on and off by itself in your site's timezone, so a campaign link can point at the sale page for exactly as long as the sale runs.

= 404s =

Every 404 is recorded and grouped by URL, with hits, when it was last seen and where visitors came from. Each 404 suggests the closest published page, and Fix opens a redirect to it ready to save. You can also ignore a 404.

A daily or weekly email lists new 404s that passed a hit threshold, so the team hears about broken links without logging in.

= Health =

The Health page finds redirect chains and loops, so visitors and search engines reach the right page in one hop.

= Conditional redirects =

As well as matching a URL, a redirect can depend on:

- Login status - only if the visitor is logged in or logged out
- WordPress capability - only if the user has a certain capability
- Browser - only for a certain browser
- Referrer - only if the visitor came from a certain page
- Cookies - only if a particular cookie is set
- HTTP headers - only if a request header matches
- Custom filter - decided by your own WordPress filter
- IP address - only for matching IP addresses
- Server - send another domain hosted on this server elsewhere
- Page type - only if the current page is a 404

= Logging =

Redirects and 404s can be logged with the visitor's browser and referrer. IP collection can be reduced or switched off to meet privacy rules where you work, and credentials such as password reset keys are never stored in logs.

= HTTP headers =

Add HTTP headers to individual redirects or to your whole site, including your own custom headers.

= Apache & Nginx =

Redirects are handled by WordPress by default. They can also be written to an Apache .htaccess file, or exported as Nginx rewrite rules.

= Permissions =

Fine-grained permissions let you decide which team members can manage redirects, see 404s or change settings.

= Import & Export =

- Import and export Apache .htaccess files
- Export Nginx rewrite rules
- Copy redirects between sites using JSON
- Import and export CSV for spreadsheets
- Automate import and export with WP-CLI

Redirects can also be imported from Redirection, Rank Math, Yoast SEO, SEOPress, Slim SEO, Pretty Links, Safe Redirect Manager, Simple 301 Redirects, 301 Redirects (EPS), SEO Redirection, Quick Page/Post Redirects and WordPress old slugs.

= Updates =

New versions appear in Dashboard > Updates like any other plugin, installed from DSuite's GitHub releases.

== Support ==

DSuite Redirects is a private plugin. Report problems to the DSuite team at [designsuite.ai](https://designsuite.ai).

== Installation ==

1. Download `dsuite-redirects.zip` from the latest GitHub release
1. Go to Plugins > Add New > Upload Plugin and upload the zip
1. Activate the plugin (deactivate Redirection first; your redirects carry over)
1. Open the Redirects menu

Later versions update from Dashboard > Updates.

== Frequently Asked Questions ==

= Why use this instead of .htaccess? =

It is easier to use. Redirects are created automatically when a post's address changes, anyone on the team can add one without editing server files, and you can see which redirects are used and which URLs are broken.

= Will it slow my site down? =

No. Redirects are matched the same way WordPress matches permalinks, and results are cached.

= Can I run it alongside Redirection? =

No. Deactivate Redirection first. DSuite Redirects uses the same data, so your redirects, groups and logs carry over.

== Changelog ==

A x.1 version increase introduces new or updated features and can be considered to contain 'breaking' changes. A x.x.1 increase is purely a bug fix and introduces no new features, and can be considered as containing no breaking changes.

= 1.4.0 - 29th October 2026 =
* New redirects keep tracking parameters (UTM, fbclid, gclid) and pass them on, so ad and email links no longer 404. Existing redirects keep matching as before
* Redirects can no longer catch the login page, wp-admin, the REST API, robots.txt, sitemaps or the shop's cart, checkout and account pages
* "Redirect here" in the admin bar makes a short link to the page you are viewing; on a 404 it offers "Redirect this 404"
* Copy a redirect's full link from the list
* Clearer descriptions of Permanent, Temporary and Gone

= 1.3.4 - 28th October 2026 =
* Dashboard > Updates shows the plugin icon

= 1.3.3 - 28th October 2026 =
* Fix: updates are found on shared hosting, where GitHub's API limit was used up by other sites on the same server
* The Plugins page says why when an update check fails

= 1.3.2 - 28th October 2026 =
* Removed-page prompt is now a card in the bottom right, with Add redirect and Not now
* Fix: the prompt also appears for custom post types, posts deleted without the trash, and deletes from the block editor

= 1.3.1 - 28th October 2026 =
* Fix: Check again on Dashboard > Updates finds a new release straight away, instead of up to 12 hours later

= 1.3.0 - 28th October 2026 =
* New: each 404 suggests the closest published page, and Fix fills it in as the target
* New: after a published post or page is trashed, a notice offers to redirect its old address

= 1.2.1 - 28th October 2026 =
* Readme describes DSuite Redirects, and the Plugins page links to designsuite.ai

= 1.2.0 - 28th October 2026 =
* New: updates appear in Dashboard > Updates and on the Plugins page, installed from the plugin's GitHub releases. Install this version by hand once; later versions update from the dashboard

= 1.1.1 - 28th October 2026 =
* Overview help: new Start here cards for first-time users (finding your way around, adding a redirect, campaign links with UTM tags, fixing 404s, checking a redirect works)
* Overview help: new cards on moving a whole section, pages that change address, and bulk changes; the Groups card explains re-enabling a group

= 1.1.0 - 28th October 2026 =
* New: Overview traffic chart for the last 7 or 30 days, with redirected visits and 404s per day
* New: Overview lists the most hit redirects and counts redirects with no hits in a year
* New: plain-language help cards on Overview explaining redirects, scheduling, groups, and chains and loops
* Fix: table header titles line up with their number columns
* Security: an unanchored regex redirect, or shortcodes in captured text, can no longer send visitors to another site
* Security: pass-through redirects need the unfiltered_html capability, and fetched pages are served sandboxed
* Security: the Apache .htaccess location must be inside the site, and only a network admin can change it on multisite
* Security: the URL monitor and old-slug import no longer take over URLs that belong to other content
* Security: credentials such as password reset keys are redacted from logs
* Security: split capabilities are enforced for 404 data on Overview, admin settings, import groups and database version changes
* Security: user agent and referrer conditions can no longer add rules to generated .htaccess or nginx config
* Security: the REST nonce is never sent to redirect.li, and updates only come from the GitHub release channel
* Fix: visitor-dependent redirects are not cached by shared caches, and redirect cache entries expire
* Fix: www/no-www domain handling, log retention timezone, exact bulk deletes in logs, Rank Math and Pretty Links imports

= 1.0.1 - 23rd October 2026 =
* Security: wildcard redirect targets are percent-encoded in the nginx export, so a target can no longer add nginx directives

= 1.0.0 - 22nd October 2026 =
First DSuite Redirects release, based on Redirection 5.10.1.
* New app-style admin: Overview, Redirects, Groups, 404s, Logs, Site & domain, Import / Export, Settings
* Create redirects by typing an old URL and picking the destination page by title
* Scheduled redirects that switch on and off by date
* Simple * wildcards
* Chain and loop detection, with one-click flatten and a pre-save check
* 404s grouped by URL with Fix, Ignore and Delete
* Daily or weekly 404 email alerts
* Replaces Redirection in place: deactivate it, activate this, and redirects, groups and logs carry over

= 5.10.1 - 17th September 2026 =
* Fix loop when importing redirects during setup process

= 5.10.0 - 29th August 2026 =
* Add support for importing/exporting `_redirects` files
* Add a Yoast SEO redirect importer
* Allow more than 25 groups to be used in the admin UI
* Fix passthrough redirects missing their target in the UI
* Fix Apache error encoder for errors other than 403
* Rework the database install process to avoid potential problems
* Tighten capability checks and improve proxy IP address handling

= 5.9.0 - 11th July 2026 =
* New and more powerful import/export
* Export everything, including settings
* Copy/paste or type redirects directly in a text box
* Preview imports and exports
* Duplicate redirect support when importing
* Improve .htaccess support

= 5.8.1 - 1st July 2026 =
* Escape CSV export values

= 5.8.0 - 8th June 2026 =
* Improve WP 7 UI
* Fix missing time in logs
* Don't run redirects on CLI usage
* Allow editing of disabled redirects

= 5.7.5 - 1st March 2026 =
* Fix delete all regression from 5.7.4

= 5.7.4 - 28th February 2026 =
* Fix display setting not saving
* Fix 'view data' on logs
* Fix missing filters on select all

= 5.7.3 - 21st February 2026 =
* Fix log target having double domain
* Fix from/notfrom data not being used when editing
* Cleaned up behaviour around pagination and checkboxes
* Improved some styles

= 5.7.2 - 17th February 2026 =
* Fix select-all bulk action
* Improve setup page handling of problems
* Improve 404 page handling of incomplete data

= 5.7.1 - 16th February 2026 =
* Fix bulk delete on log and 404 page
* Restore filter by IP button
* Remove referrer from standard log display

= 5.7 - 15th February 2026 =
* Bump minimum PHP to 7.4
* Add multi-select support with shift-click in tables
* Add WP-CLI verbose flag for settings command to display setting names
* Improve log deletion performance with adaptive batch sizing for large backlogs
* Add permissions policy header
* Improve trash monitoring

= 5.6.1 - 17th January 2026 =
* Fix issue with spaces in Apache .htaccess
* Add some checks for sites with opcache to help with renamed files
* Fix inverted caching of unmatched URLs

= 5.6.0 - 1st January 2026 =
* Streamlined bundle size
* Update for WP 6.9
* Bump minimum PHP to 7.2

= 5.5.2 - 16th February 2025 =
* Fix saving of x-frame-options
* Fix CPT loading
* Fix last access date changing on update
* Remove newsletter option

= 5.5.1 - 24th November 2024 =
* Fix problem with category pages and permalink migration
* Don't report invalid JSON import as successful
* Exclude CPTs without URLs for monitoring
* Update for WP 6.7

= 5.5.0 - 10th August 2024 =
* Multiple 'URL and WP page type' redirects will now work
* Translations now use WP core

= 5.4.2 - 27th January 2024 =
* Remove Geo IP option (it may return)
* Fix crash in agent info
* Add new max-age header
* Remove deprecated ini_set call
* Don't double encode URLs when checking

= 5.4.1 - 5th January 2024 =
* Fix problem with some international URLs not appearing in the 404 log

= 5.4 - 1st January 2024 =
* Don't encode negative lookaheads
* Remove port from server name
* Importing into a disabled group now creates disabled items
* Add option to pick IP header
* Fix save of x-content-type-options: sniff
* Fix save of multiple spaces

= 5.3.10 - 2nd April 2023 =
* Fix associated redirect setting not saving properly

= 5.3.9 - 25th January 2023 =
* Fix incorrect sanitization applied to target URLs

= 5.3.8 - 22nd January 2023 =
* Fix app rendering twice causing problems with upgrades
* Fix CSV header being detected as an error

= 5.3.7 - 8th January 2023 =
* Fix problem with locales in certain directories
* Fix incorrect import of empty CSV lines
* Don't encode regex for Nginx

= 5.3.6 - 12th November 2022 =
* Fix for sites with a version of +OK
* Another fix for CZ locale

= 5.3.5 - 6th November 2022 =
* Fix crash on options page for Czech language

= 5.3.4 - 14th September 2022 =
* Fix query parameter name with a + not matching

= 5.3.3 - 7th September 2022 =
* Fix default HTTP header not being set when first used
* Fix incorrect column heading in CSV
* Fix passing of mixed case parameters

= 5.3.2 - 6th August 2022 =
* Fix missing props error
* Fix missing value for .htaccess location display

= 5.3.1 - 29th July 2022 =
* Fix crash caused by bad translations in locale files
* Fix query match not working when it contained mixed case
* Fix missing flag in .htaccess export

= 5.3.0 - 21st July 2022 =
* Improve installation process
* Improve permalink migration so it works with more permalinks
* Prevent ordering columns by HTTP code
* Better encode URLs in Nginx export
* Allow escaped characters to work in the redirect checker
* Reduce CSV import time

= 5.2.3 - 6th February 2022 =
* Fix error when grouping by URL, adding redirect, and then adding another redirect
* Add a warning for unescaped ? regex

= 5.2.2 - 22nd January 2022 =
* Further improve URL checker response to clarify responsibility
* Fix WordPress and pagetype match preventing the logging of 404s
* Fix title field being inactive
* Fix CSV export having duplicate column

= 5.2.1 - 16th January 2022 =
* Include path with inline URL checker

= 5.2 - 15th January 2022 =
* Improve URL checker and show more details
* Retain query parameter case when passing to target URL
* Remove unnecessary database stage option check
* PHP 8.1 compatibility

= 5.1.3 - 24th July 2021 =
* Fix geo IP on log pages showing an API redirected error
* Fix crash when changing match type in edit dialog

= 5.1.2 - 17th July 2021 =
* Fix random redirect not working
* Fix [userid] shortcode returning 1

= 5.1.1 - 11th April 2021 =
* Revert the permalink migration improvement from 5.1 as it's causing problems on some sites

= 5.1 - 10th April 2021 =
* Add importer for PrettyLinks
* Fix crash converting a 'do nothing' to 'redirect to URL'
* Improve warning messages
* Improve permalink migration when is_404 is not set
* Fix 'delete log entries' returning blank data
* Fix missing .htaccess location
* Fix hits & date not imported with JSON format

= 5.0.1 - 26th Jan 2021 =
* Fix incorrect warning when creating a regular expression with captured data
* Fix JS error when upgrading a database with a broken REST API
* Increase regular expression redirect limit
* PHP8 support

= 5.0 - 16th Jan 2021 =
* Add caching support
* Add support for migrated permalink structures
* Add dynamic URL variables
* Add fully automatic database upgrade option
* Add a new version release information prompt
* Improve performance when many redirects have the same path
* Move bulk all action to a separate button after selecting all
* Fix error in display with restricted capabilities
* Avoid problems with 7G Firewall
* Improve handling of invalid encoded characters
