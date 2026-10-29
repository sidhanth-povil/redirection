# Mission: Marketer Guardrails (phases 10–13)

- **Date:** 2026-10-29
- **Input:** external suggestion list (intent picker, UTM pass-through, chain resolver, scheduling, slug watcher, QR, protected routes, CSV dry-run, static compiler, test pill, campaign tags, admin-bar quick-create)
- **Goal:** close the gaps that still let a marketer break tracking, SEO or the site, without adding infra we have to babysit.

## 1. Triage: suggestion vs. what ships today (v1.3.4)

| # | Suggestion | Today | Verdict |
|---|---|---|---|
| 1 | Intent-based status picker | ✅ Drawer segmented: Permanent (301) · Temporary (302) · Gone (410); rest under Advanced | **Copy tweak only** — relabel to intent ("Page moved for good", "Campaign / temporary", "Deleted for good") |
| 2 | Query & UTM pass-through, default ON | ⚠️ Upstream `flag_query` default `exact`: `/winter-sale?utm_source=ig` likely **doesn't match** `/winter-sale` at all → ad traffic 404s | **Build — P10, top priority** |
| 3 | Auto-flattening chain resolver | ✅ Chain/loop detection, Overview "Flatten", drawer precheck "Point straight to X", loop blocks save, duplicate warning | **Build the missing half — P12:** when the new source is someone else's target, offer "Also repoint N redirects to the new target". Prompt, never silent mass-rewrite |
| 4 | Scheduled & expiring redirects | ✅ start/end, UTC, badges, filters | **Build fallback — P12:** "When it ends, send to …" |
| 5 | Post search + slug watcher | ✅ Title search via `/wp/v2/search`, stores permalink. ❌ slug change leaves target stale (monitor adds old→new, so we get a chain) | **Build — P11:** rewrite targets on slug change |
| 6 | QR + copy shortlink | ❌ | **Copy URL — P10. QR — P13** (needs one small lazy-loaded dep) |
| 7 | Protected route blacklist | ⚠️ Only blocks `*` and `/*` (`includes/redirect/class-sanitize.php:144`) | **Build — P10** |
| 8 | CSV dry-run importer | ✅ Drag-drop + preview mode (`dry_run`), duplicate matcher exists | **Extend — P12:** flag chains, dead local targets, duplicates, protected paths in the preview table |
| 9 | Static PHP map + mu-plugin | Lookup = one indexed `match_url` query + optional object cache | **Skip.** See §3 |
| 10 | Inline "Test" pill | ⚠️ Support page HTTP tester calls external redirect.li | **Build — P11:** own server-side `/test` endpoint |
| 11 | Mandatory context note / campaign tag | ⚠️ `title` field + groups exist | **Build light — P13:** reuse groups as tags, title as note. Decision needed (§4) |
| 12 | Admin-bar quick-create | ❌ | **Build — P10:** admin-bar link opening drawer with destination prefilled (no frontend React) |

## 2. Phases

Each phase ships and releases (`pnpm release`) before the next. TDD per repo rules; PHP tests via wp-env.

### P10 — Quick guardrails (small, high value)

1. **UTM pass-through default**
   - RED: integration test — redirect `/winter-sale` → `/shop/winter/?utm_campaign=bf`; request `/winter-sale?utm_source=ig&fbclid=1` must 301 to `/shop/winter/?utm_campaign=bf&utm_source=ig&fbclid=1`. Same key in both → keep destination's value (hardcoded campaign wins), no duplicate key.
   - Confirm current behaviour first (test may prove `exact` already matches; then only the merge part is new).
   - Fix: new-redirect default `flag_query = pass` (settings default + drawer default). Existing rows untouched. Check `Query` merge for duplicate keys; fix there if needed (one shared function, all callers).
   - Drawer: Advanced shows "Keep tracking parameters (UTM, fbclid, gclid)" switch, ON.
2. **Protected paths**
   - In sanitizer: refuse sources that hit `wp-admin`, `wp-login.php`, `wp-json`, `xmlrpc.php`, `wp-cron.php`, `wc-api`, `robots.txt`, `sitemap*.xml`, and Woo cart/checkout/my-account (resolved via `wc_get_page_permalink` when Woo active, so translated slugs work).
   - Plain source: prefix match. Wildcard/regex source: compile (reuse `Wildcard::to_regex`) and test against a probe list (`/wp-admin/`, `/wp-login.php`, `/wp-json/wp/v2/`, `/cart/`, …).
   - Filter `dsr_protected_paths` for site-specific additions. Error copy says which path it would break.
   - Pure function + unit test with probe matrix.
3. **Admin-bar quick-create**
   - `admin_bar_menu` node on frontend, for users with plugin access: "Create redirect to this page" → `admin.php?page=dsuite-redirects.php#/redirects?new=1&to=<current permalink>`.
   - Router: accept `to=` alongside existing `from=`; drawer prefills target + defaults type to Temporary.
4. **Copy full URL** — row action using `navigator.clipboard`, toast "Copied".
5. **Intent copy** on the type segmented control (labels + one-line hint; codes still visible as small badge).

### P11 — Trust what you saved

1. **Test pill (own endpoint)**
   - `POST redirection/v1/test {id}` → server `wp_remote_head( home_url( source ) . '?utm_source=dsr-test', [ 'redirection' => 0, 'timeout' => 5 ] )` with a cache-busting param and `Cache-Control: no-cache`.
   - Returns `{ code, location, ms, utm_preserved }`. Toast: "✓ Resolves to /pricing/ (302 Temporary) in 14ms — UTMs preserved".
   - Plain sources only; wildcard/regex rows get a "Test with URL…" input.
   - Loopback failures (common on some hosts): show the WP error message, not a fake fail. Permission: plugin-access capability + nonce. Only same-host URLs (no SSRF: the URL is always built from `home_url()`).
   - Move the Support page HTTP tester to the same endpoint, drop redirect.li dependency.
2. **Slug watcher**
   - On `post_updated` when permalink changes: `UPDATE redirection_items SET action_data = new WHERE action_type='url' AND action_data IN (old absolute, old relative)`. Clear cache. Fire existing `redirection_redirect_updated`.
   - Result: no chain from monitor's old→new redirect. Integration test: create redirect → page, change slug, request source, single hop to new slug.
   - `ponytail:` exact-string match only; targets with query strings appended aren't rewritten — Health chain detector still catches them.

### P12 — Bigger flows

1. **Chain repoint on save** — `/check` already knows the map. Add `inbound: [ids]` (redirects whose target == this source). Drawer: "3 redirects point to /c. Repoint them to /d too?" [checkbox, on]. Save = existing update route per id (or one bulk call). Loop still blocks.
2. **Schedule fallback** — drawer field "When it ends, send visitors to …". Implementation: create a companion plain redirect, same source, unscheduled, position after the scheduled one; link via `match_data.schedule.fallback_of = <id>`; deleting the parent deletes the companion. Zero query/schema change — the matcher already picks the first live row by position. Verify ordering with an integration test across the end boundary.
3. **Import pre-flight** — extend preview rows with `issues[]`: `duplicate` (existing matcher), `chain` / `loop` (Chains engine fed existing map + import rows), `dead_target` (local target only: `url_to_postid` = 0 and not a known source; externals not fetched — 200 HEADs is too slow), `protected` (P10 function). Rows with issues render red; "Import only clean rows" button.

### P13 — Nice to have

1. **QR code** — row action "Download QR (SVG)". Use `qrcode-generator` (MIT, ~20 KB, no deps), dynamic `import()` so it loads only on click. Breaks spec rule "no new runtime deps" — one justified exception.
2. **Campaign tags** — see §4.

## 3. Skipped: static PHP map + mu-plugin

- Current hot path is one indexed query on `match_url` (plus optional object cache). Not a measured bottleneck.
- Writing executable PHP into `uploads/` is a classic attack target and many hosts block PHP execution there; writing into `mu-plugins/` needs file perms we can't count on across client hosts.
- The map can't express conditions (login, role, cookie…), schedules, regex order or hit logging, so it'd be a second matching engine to keep in sync.
- **Revisit when:** a client site shows redirect lookup in a profiler. Then cache the exact-match map in the object cache (not a PHP file) keyed on a version bumped on every redirect change.

## 4. Decisions for the user

1. **Campaign tags:** (a) reuse Groups as tags — seed "Print QR", "Meta Ad", "SEO Migration", "Bio Link", show as pill, no schema (recommended); or (b) new `tag` column via DSR upgrader v2, separate from groups. Mandatory on new manual redirects only (not imports / auto slug redirects) either way.
2. **Protected paths:** hard block (recommended), or block with an Advanced "I know what I'm doing" override for admins?
3. **UTM default:** apply `pass` to new redirects only (recommended), or also offer a one-click migration for existing `exact` rows on Overview?

## 5. Done when

- Each phase: PHP unit + integration (wp-env), Jest, `phpcs`, existing suites green; marketer-flow E2E extended for admin-bar create and Test pill.
- Release per phase, changelog entry per feature.
