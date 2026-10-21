# DSuite Redirects — Design Spec

- **Date:** 2026-10-21
- **Status:** Approved in brainstorming, pending written-spec review
- **Base:** fork of [johngodley/redirection](https://github.com/johngodley/redirection) 5.10.1 at `811f440` (fork: `sidhanth-povil/redirection`)

## 1. Intent

### What was asked
Turn the forked Redirection plugin into our own redirect plugin, **DSuite Redirects**, with:
- a clean, breathable UI and UX built for a **marketing team**
- the redirect features advertised by AIOSEO's Redirection Manager that Redirection lacks
- **no AI features** of any kind

### Who it is for
- **Users:** marketing team members who fix 404s, create campaign redirects and handle URL changes, without knowing regex or server config.
- **Admins:** developers who still need regex, conditions, headers and server-config export.
- **Distribution:** private. Our sites and client sites only. Not on WordPress.org and not sold, so there is no licensing, no upsells and no wp.org guideline constraints.

### Success criteria
1. A marketer opens the plugin, sees what's broken (new 404s, chains, expiring redirects) on one screen, and fixes an item in about 2 clicks.
2. A marketer creates a redirect by typing an old URL, picking the destination page by title, and saving. No regex, no URL pasting.
3. Campaign redirects can be scheduled to start and/or end on set dates and switch on and off by themselves.
4. The team gets an email when new 404s appear, without logging in.
5. Redirect chains and loops are flagged and can be flattened in one click.
6. The plugin UI never breaks or restyles the native WordPress admin menu or other admin screens, at any viewport width.
7. Sites already running Redirection switch to DSuite Redirects in place, keeping all redirects, groups and logs.

### Out of scope (v1)
- Any AI or LLM functionality
- Block-editor prompt when a post is trashed or its slug changes (the existing silent auto-redirect from `monitor` stays as is)
- Dark mode (WP admin has none)
- Licensing, freemium, telemetry
- Chain detection through regex or wildcard redirects (see §5.4)

## 2. Starting point (what upstream already provides)

| Capability | Status in upstream 5.10.1 |
|---|---|
| 301/302/303/304/307/308, 410, pass-through, random, error actions | ✅ `includes/action/*` |
| Regex sources, query/case/trailing-slash flags | ✅ `includes/url/class-source-flags.php` |
| Conditional matching (login, role, referrer, UA, cookie, IP, header, language, server, page, custom filter) | ✅ `includes/compare/*` |
| Redirect logs and 404 logs (hits, UA, referrer, IP) | ✅ `redirection_logs`, `redirection_404` |
| Import/export CSV, JSON, Apache, Nginx; import from other plugins | ✅ `includes/import-export/*` |
| Auto-redirect on slug change / trash | ✅ `models/monitor.php` |
| Site relocate, domain aliases, force HTTPS, preferred www, site headers | ✅ `src/page/site/*`, `includes/plugin/class-canonical.php` |
| Object-cache redirect cache | ✅ `includes/redirect/class-cache.php` |
| WP-Cron job pattern | ✅ `includes/plugin/class-flusher.php` |
| REST API | ✅ namespace `redirection/v1`, `includes/api/*` |
| **Scheduled / expiring redirects** | ❌ new |
| **Simple `*` wildcards** | ❌ new |
| **404 email alerts** | ❌ new |
| **Chain / loop detection** | ❌ new |
| **Overview dashboard** | ❌ new |
| **Marketer-friendly UI** | ❌ rebuild |

Upstream is partway through moving from legacy `models/` classes to the namespaced `includes/` tree. Legacy names are aliased in `redirection-refactor.php`. **All new PHP goes in `includes/` under the `Redirection\` namespace.**

## 3. Fork model and rebrand

**Decision:** hard fork with our own brand. Internals stay unchanged.

### Changes
- Plugin directory and main file: `dsuite-redirects/dsuite-redirects.php` (renamed from `redirection.php`), with plugin header Name `DSuite Redirects`.
- Text domain `dsuite-redirects` in PHP (`__()`, `_e()`, etc.) and JS (`@wordpress/i18n`). Bundled upstream `.po/.mo` translations are dropped.
- Admin menu: one **top-level** menu item "Redirects" (`add_menu_page`, dashicon `dashicons-randomize`), replacing upstream's `add_management_page`. **No WP submenu items**; navigation happens in the plugin's own sidebar.
- Assets: plugin icon and banner, footer "powered by" component rebranded or removed, support/donation links removed.
- `package.json` / `composer.json` names, `readme.txt`, release scripts (`pnpm plugin`, `plugin:zip`) produce `dsuite-redirects.zip`.

### Unchanged (on purpose)
- PHP namespace `Redirection\`, legacy class aliases, `REDIRECTION_*` constants
- DB tables `{prefix}redirection_items|groups|logs|404`
- Option keys (`redirection_options`, etc.)
- REST namespace `redirection/v1`

**Why:** existing Redirection sites migrate in place (deactivate Redirection, activate DSuite Redirects, and everything is there), and upstream fixes stay cheap to cherry-pick.

### Coexistence guard
On activation, and on `admin_init`, if the original Redirection plugin (`redirection/redirection.php`) is active, DSuite Redirects:
- refuses activation (`register_activation_hook` → `wp_die` with explanation) or, if already active, self-deactivates
- shows an admin notice: "Deactivate Redirection before using DSuite Redirects. Your redirects will carry over."

### Own schema versioning
- Upstream's `REDIRECTION_DB_VERSION` (`4.2`) is **never bumped** by us.
- DSuite schema changes are tracked in a separate option `dsr_db_version` (integer, starting at `1`), with their own upgrader `includes/database/class-dsr-upgrader.php`, run after upstream's upgrader.
- Upstream schema migrations we cherry-pick later apply as usual and never collide with ours.

### Updates
- v1 is installed and updated by uploading the release zip (`pnpm plugin:zip`).
- An auto-updater is deferred until the number of sites makes manual uploads painful. When it is needed, it hooks `pre_set_site_transient_update_plugins` and reads GitHub Releases, with any token in a `wp-config.php` constant.

## 4. UI / UX

### 4.1 Decisions made with mockups
- **Layout B:** app-style sidebar inside the plugin page, landing on **Overview**.
- **Style A:** soft indigo. Rounded corners, soft colour badges, indigo accent, generous spacing.
- **Drawer A:** one create/edit form, with an "Advanced" accordion collapsed at the bottom.

Mockups are kept in `.superpowers/brainstorm/*/content/` (`layout-v2.html`, `visual-style.html`, `editor-drawer.html`).

### 4.2 Hard constraints: never break WP admin
1. The React app mounts into a single root, `<div id="dsr-app" class="dsr-app">`, inside the page's `.wrap`. No styles target `#adminmenu`, `#adminmenuwrap`, `#wpcontent`, `#wpbody`, `body`, `html` or bare element selectors.
2. Every selector is prefixed `.dsr-`. No global CSS reset, no Tailwind preflight, no `* {}` rules.
3. Responsive behaviour is driven by **container queries** on `.dsr-app` (`container-type: inline-size`), so the layout reacts to the space actually available whether the WP menu is expanded, folded or hidden. Breakpoints line up with WP's (782px, 960px).
4. Card grids use `repeat(auto-fit, minmax(…, 1fr))`. Flex children holding URLs get `min-width: 0` and ellipsis truncation, with the full URL in a `title` attribute.
5. Drawer and modals render in a portal with z-index **below** WP's admin bar (`99999`) and **above** the admin menu (`9990`). Focus is trapped inside (`react-focus-lock`, already a dependency).
6. Acceptance check: screenshots at 1440, 1100 (WP menu folded) and 375px wide, one per WP menu state. No horizontal page scroll, and the WP menu looks identical to stock.

### 4.3 Design system: `src/ui/`
- `tokens.scss`: `--dsr-*` CSS custom properties on `.dsr-app` for colour (accent `#4f46e5`, surfaces, borders, text tiers), status colours (301 green, 302 blue, scheduled amber, disabled grey, error red), radius (8 / 10 / 12px), spacing scale (4px base), font (inherits WP system stack), shadows.
- React components (only where markup or behaviour repeats): `Button`, `Card`, `Drawer`, `Combobox`, `Segmented`, `Badge`, `Table`.
- Everything else is native HTML plus a `.dsr-` class, with no wrapper component:
  - Advanced section: `<details>/<summary>`
  - Toggle: `<input type="checkbox" role="switch">`
  - Schedule dates: `<input type="datetime-local">`
  - Notices and empty states: a styled `<div>`
  - KPI tiles: `Card`
- Each component is one folder holding `index.tsx` and `style.scss`. Props are typed. Accessibility basics are required: labels, `aria-*`, keyboard support, visible focus rings, AA colour contrast.
- Existing dependencies are reused: `@headlessui/react` (Combobox), `react-focus-lock` (Drawer). **No new runtime dependencies.**

### 4.4 App shell
- `src/app.tsx` becomes the shell: sidebar on the left, page content on the right.
- Hash routes: `#/overview` (default), `#/redirects`, `#/404s`, `#/logs`, `#/site`, `#/import-export`, `#/settings`, plus `#/support` (upstream debug and status info). Query parameters are allowed, e.g. `#/redirects?new=1&from=/x`.
- Sidebar items show a badge with the count of new 404s.
- Below a container width of 782px, the sidebar collapses into a horizontally scrolling tab strip above the content.
- Pages are swapped one at a time. Each old `src/page/*` component is deleted when its replacement lands, so the codebase never carries two UIs.

### 4.5 Pages
**Overview (new)**
- KPI cards: Active redirects · New 404s (7 days) · Chains & loops · Scheduled (upcoming or ending within 7 days).
- A "Needs attention" list, merged and sorted by impact:
  - 404s by hits, with a **Fix** button that opens the drawer already filled in
  - Chains and loops, with a **Flatten** button
  - Scheduled redirects ending within 7 days, with an **Extend** button that opens the drawer on the dates
- Empty state: "All clear. Nothing needs attention."

**Redirects**
- Search across source, target and title.
- Filter chips: All · Live · Scheduled · Expired · Disabled · by group.
- Each row shows source (bold), target (muted, beneath), a type badge, a schedule badge when set, hits, and last hit.
- Row actions: Edit · Disable/Enable · Delete. Bulk select supports Enable · Disable · Delete · Move to group · Export.
- The upstream table store and API hooks are reused.

**Redirect drawer (create/edit)**
- **Old URL:** shows the site domain as a prefix, with the hint "Use `*` to match everything under a path".
- **Send visitors to:** a combobox. Typing searches posts, pages and public CPTs by title via WP core REST `/wp/v2/search`. Picking a result fills in its permalink. Any URL can also be typed freely.
- **Type:** segmented control with Permanent (301) · Temporary (302) · Gone (410). Every other action and code (307, 308, pass-through, random, error, nothing) lives under Advanced.
- **Schedule:** a toggle, then start and end date-times in the site timezone, stored as UTC. Either end can be left empty.
- **Pre-save check:** runs after the user stops typing (debounced, `use-debounce`). It calls `POST redirection/v1/check` and shows either a green result or an amber warning with a one-click fix, covering:
  - chain: the target already redirects elsewhere → "Point straight to X"
  - loop: the target redirects back to the source → saving is blocked
  - duplicate source → link to the existing redirect
- **Advanced accordion:** regex, wildcard/regex/query/case/trailing flags, match type and conditions, headers, group, title, position. It reuses upstream's `src/component/redirect-edit` field logic, restyled. Its open or closed state is remembered in `localStorage` (`dsr_advanced_open`, read and written inside try/catch); it's a convenience only, so no user meta and no REST call.
- Footer: Cancel · Save redirect. Unsaved changes trigger a confirm on close (upstream `prevent-leave`).

**404s**
- Grouped by URL, with hits, last seen and top referrer.
- Row actions: **Fix** (drawer, prefilled), Ignore (adds to the existing ignore list), Delete. Filter chips: New this week · All · Ignored.

**Logs, Site & domain, Import/Export, Settings**
- Restyled with `src/ui` components. Behaviour is unchanged.
- Settings gains a **404 alerts** section (§5.3).

## 5. New features

### 5.1 Scheduled / expiring redirects

**Schema** (`dsr_db_version` 1)
```sql
ALTER TABLE {prefix}redirection_items
  ADD COLUMN start_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN end_at   DATETIME NULL DEFAULT NULL,
  ADD KEY schedule (start_at, end_at);
```
- Values are UTC. `NULL` means unbounded.
- Validation: if both are set, `end_at` must be later than `start_at`. Otherwise the REST call returns 400 with a field error.

**Matching**
- Both lookup queries in `includes/redirect/class-redirect.php` (the exact `match_url IN (…)` query and the regex/group query) get:
  ```sql
  AND (start_at IS NULL OR start_at <= %s) AND (end_at IS NULL OR end_at > %s)
  ```
  with `%s = gmdate('Y-m-d H:i:s')`.
- No cron job is needed for correctness: the query alone switches a redirect on and off at the right times.

**Cache**
- In `Cache::set()`, a lookup result is not cached when any candidate row has `start_at` or `end_at`. That one guard means scheduled redirects never go stale, with no cron job.
- The redirect cache is off by default (`cache_key => 0`), so this only matters on sites that turn it on.

**Status**
- `status` (`enabled` / `disabled`) keeps its meaning.
- The derived state is computed in PHP and returned in the redirect JSON as `schedule_state`, one of `live`, `scheduled`, `expired` or `none`, for the badges and filters.

**Server-config export**
- The Apache and Nginx modules skip redirects that have any `start_at` or `end_at`.
- The export UI shows: "N scheduled redirects are not included. Server config files can't schedule."

**Import/export**
- CSV and JSON exports include `start_at` and `end_at`. Imports accept them as optional fields.

### 5.2 Wildcards

- New source flag `flag_wildcard` in `includes/url/class-source-flags.php`. `flag_wildcard` and `flag_regex` are mutually exclusive, and the sanitizer rejects both being set.
- **Detection:** a source containing `*` with the regex flag off gets `flag_wildcard = true` automatically. The drawer shows a "Wildcard" badge.
- A literal `*` in a plain source is therefore not supported. Anyone who needs one turns on regex and escapes it (`\*`).
- Existing upstream redirects whose plain source contains `*` keep working as before, because detection only runs when a redirect is saved, not on stored rows.
- **Storage:** `url` keeps the source exactly as typed (e.g. `/blog/*`). The record is also given `regex = 1` and `match_url = 'regex'`, so it is fetched by the existing regex lookup and needs no new query.
- **Matching:** `includes/url/class-wildcard.php`, a pure class with no WP dependencies:
  - `to_regex( string $source ): string` quotes each literal segment with `preg_quote`, joins them with `(.*)`, and wraps the result as `^…$` (with the `i` flag if case-insensitive).
  - `apply_target( string $target, array $captures ): string` replaces each `*` in the target, in order, with the matching capture. Extra `*`s are replaced with an empty string.
- The regex path in the URL matcher checks `flag_wildcard` first. If it is set, the pattern comes from `Wildcard::to_regex` rather than the raw `url`.
- Example: `/blog/*` → `/news/*` turns `/blog/2024/hello` into `/news/2024/hello`.
- Wildcard sources are exported to Apache and Nginx as their compiled regex.

### 5.3 404 email alerts

**Settings** (inside `redirection_options`, under the `dsr_alerts` key)
| Field | Type | Default |
|---|---|---|
| `enabled` | bool | `false` |
| `frequency` | `daily` \| `weekly` | `weekly` |
| `recipients` | string[] (validated with `is_email`) | `[ admin_email ]` |
| `min_hits` | int ≥ 1 | `3` |
| `last_sent` | UTC datetime | `null` |

**Job**
- The WP-Cron hook `dsr_404_digest` is scheduled on the chosen frequency, using the same scheduling and unscheduling pattern as `class-flusher.php`.
- It is (re)scheduled when the settings are saved and cleared on deactivation.

**Content**
- Queries `redirection_404` for URLs with `created > last_sent` (or the last 7 days on first run), grouped by URL.
- Keeps only URLs with hits ≥ `min_hits`.
- Leaves out URLs that a currently live redirect already matches, checked via the existing redirect matcher.
- Takes the top 20 by hits.
- If there are no rows, no email is sent. `last_sent` is updated either way.

**Email**
- Sent with `wp_mail`, HTML.
- Subject: `[Site] 12 new 404s this week`.
- Body: a table of URL, hits, top referrer and a **Create redirect** link to `admin.php?page=dsuite-redirects.php#/redirects?new=1&from=<urlencoded>`.
- Footer link: "Manage alerts".
- The table only works if 404 logging is enabled. The settings UI warns if alerts are on but 404 logging is off.

### 5.4 Chain and loop detection

**Engine:** `includes/health/class-chains.php`
- Loads enabled, live (by schedule) redirects of action type `url` whose source is **plain** (neither regex nor wildcard) and whose target is local (same host, or relative).
- Builds a map from normalised source path to `{id, target path}`. Normalisation uses the existing URL path helpers: trailing slash and case are handled according to each redirect's flags.
- For each source, it follows targets through the map with a visited set:
  - **Chain:** the path is 3 or more nodes long (A→B→C…). The result includes the full path and the final target.
  - **Loop:** the walk reaches a node already visited. The result includes the cycle.
- Complexity is O(n) per walk and O(n²) in the worst case. `ponytail:` regex/wildcard redirects are skipped, because following them means testing every URL against every pattern; add pattern-aware walking if real data shows chains hiding behind regex.
- It is computed on each request with no cache: one query plus an O(n) walk, which is cheap at the redirect counts we expect. `ponytail:` no cache; if `/health` gets slow on big sites, add a transient and clear it on `redirection_redirect_updated|deleted|enabled|disabled`.

**REST** (namespace `redirection/v1`, capability: the existing plugin-access capability)
- `GET /health` → `{ counts: {active, new404s, chains, loops, scheduled}, attention: [...] }`, used by Overview.
- `POST /check` `{source, target, id?}` → `{ status: ok|chain|loop|duplicate, path?, final_target?, existing_id? }`, used by the drawer's pre-save check. It runs against the in-memory map plus the candidate redirect.
- **Flatten has no endpoint.** `/health` already returns each chain's `final_target`, and the client saves it with the existing redirect update route. The Flatten button is not shown for loops, because loops need a human decision.

### 5.5 Explicitly unchanged
- Auto-redirect on slug change or trash (`monitor`) keeps upstream behaviour and settings.
- Conditional matching, import-from-plugins, logs, relocate, aliases, canonical and headers keep their behaviour; only the UI is restyled.

## 6. Error handling
- REST endpoints validate input with `register_rest_route` args and sanitisers. Invalid input → 400 with field-level messages, which the drawer shows next to the field.
- The drawer shows server errors in a `Notice` at the top. Its state is kept so nothing typed is lost.
- If the DSR upgrader fails, it logs to `error_log` and leaves `dsr_db_version` unchanged, so it simply runs again on the next admin page load; there's no retry UI. Matching never assumes the new columns exist until `dsr_db_version >= 1` (it falls back to the upstream query).
- If `wp_mail` fails in the digest, it logs the failure and leaves `last_sent` unchanged so the next run retries.
- If a GitHub update check fails, it does so silently. An update failure must never break the admin.

## 7. Security
- Every new REST route uses upstream's `Capabilities::get_plugin_access()` permission callback plus the REST nonce. No public endpoints.
- `/health` and `/check` are read-only and use the same capability as the redirect routes.
- Wildcard compilation always uses `preg_quote` on literal parts, so user input can never inject regex.
- Email recipients are validated with `is_email`. URLs in the digest are escaped (`esc_url`, `esc_html`).

## 8. Testing
**PHP unit tests** (PHPUnit, `composer run test-unit`)
- `Wildcard::to_regex` and `apply_target`: single and multiple `*`, special characters in literals, case flag, extra target `*`s
- Schedule clause: null/null, start only, end only, window, past-expired, future
- Chain engine: simple chain, long chain, loop, self-loop, trailing-slash and case normalisation, mixed regex redirects ignored
- Digest builder: `min_hits` filter, exclusion of redirected URLs, top-20 cap, empty → no mail
- Sanitizer: rejects wildcard and regex both set, rejects `end_at <= start_at`

**PHP integration tests** (`wp-env`, `composer run test-integration`)
- The DSR upgrader adds the columns and index on a site with upstream's 4.2 schema, and running it twice is safe
- End-to-end redirect matching: a scheduled redirect matches only inside its window, a wildcard redirect matches and substitutes
- Coexistence guard blocks activation while Redirection is active

**JS tests** (Jest, `pnpm test:js`)
- Drawer: type mapping, wildcard badge detection, schedule validation, check-result rendering
- Shell: route parsing including query parameters, sidebar collapsing to tabs on narrow containers
- `src/ui` components: keyboard and ARIA behaviour for Combobox, Segmented, Drawer focus trap

**E2E tests** (existing `pnpm test:e2e` harness)
- Marketer flow: Overview → Fix a 404 → drawer prefilled → pick a page → save → the 404 URL now redirects
- The width screenshot matrix from §4.2.6

**Regression**
- All existing upstream PHP and JS suites must still pass.

## 9. Build order
Each phase ships working software and is merged before the next starts.

1. **Rebrand and foundation:** renames, text domain, top-level menu, coexistence guard.
2. **Design system and shell:** `src/ui` tokens and components, app shell, hash router, sidebar/tab collapse, width screenshot matrix.
3. **Redirects page and drawer:** new list, drawer with destination combobox, plain-language types, Advanced accordion. Old redirects page deleted.
4. **Scheduling:** `dsr_db_version` upgrader with schema v1, query clause, cache guard, badges and filters, export handling.
5. **Wildcards:** source flag, `Wildcard` class, matcher hook, drawer badge.
6. **Health and Overview:** chain engine, `/health`, `/check`, Overview page, pre-save check in the drawer, Flatten via the existing update route.
7. **404s page and alerts:** 404s page restyle with Fix, digest cron and email, settings section.
8. **Restyle the remaining pages:** Logs, Site, Import/Export, Settings, Support. Delete the leftover old UI.

## 10. Risks
| Risk | Mitigation |
|---|---|
| Upstream cherry-picks conflict with UI rebuild | UI lives in new files; PHP internals untouched; separate schema versioning |
| Scheduling clause slows lookup on large sites | Composite `schedule` index; clause is two indexed comparisons; benchmark with 50k redirects in integration test |
| Object cache serves stale redirect across schedule boundary | Lookups involving scheduled rows are never cached (§5.1) |
| WP-Cron unreliable on low-traffic sites → late digests | Acceptable for a digest; document `DISABLE_WP_CRON` + server cron |
| Container queries unsupported in old browsers | All WP-supported browsers (last 2 versions) support them; fallback layout is the stacked mobile view |
