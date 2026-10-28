# Phase 9: Overview Analytics, Help Cards, Table Header Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. RED → GREEN per task; the named tests are the binding contract.

**Source:** feedback from the first live install (marketing / SEO team, 2026-10-27). Extends Phase 6 (`2026-10-22-phase6-health-overview.md`).

**Goal:** Overview becomes the page the marketing team opens first: a full-width traffic chart, a few numbers they can act on, and plain-language help on how redirects, scheduling and groups work. Number columns line up with their headers on every table.

**Architecture:**
- **Header fix** is one CSS rule. `.dsr-app .dsr-table th { text-align: left }` (0,2,1) outranks `.dsr-app .dsr-num { text-align: right }` (0,2,0), so every numeric header stays left while its cells go right. Raising `.dsr-num` to `.dsr-app .dsr-table .dsr-num` fixes Redirects, Groups, Logs and 404s at once.
- **Traffic data** comes from a new read-only `GET /health/traffic?days=7|30` on the existing `Health` route class. It groups `redirection_logs` and `redirection_404` by `DATE(created)` (both have a `created` index) and returns one row per day with zeros filled in, plus the top redirects by hits in the window. Days are in the site timezone.
- **Chart** is a hand-written inline SVG bar chart in `src/page/overview/traffic-chart.tsx`: two series (redirected, 404), a 7 / 30-day `Segmented` toggle, a hover/focus tooltip, and a visually hidden data table for screen readers. No chart library; the bundle has none and two bar series don't justify one.
- **Help cards** are static copy in `src/page/overview/help-cards.tsx`, inside one collapsible section that remembers open/closed per browser (`localStorage`, wrapped in try/catch).

## Decisions
1. **The chart only shows what the logs hold.** Per-day hits exist only in the log tables. Redirect rows store lifetime `hits` and `last_access`, not history. Retention defaults to 7 days (`expire_redirect`, `expire_404`; max 60, `-1` = off). The API returns `retention` for both logs, and the UI:
   - offers 30 days only when retention allows it (or is 0, meaning keep forever),
   - replaces the redirect series with "Redirect logging is off. Turn it on in Settings to see traffic." plus a link to `#/options` when `expire_redirect === -1` (same for 404s),
   - shows "Showing the last N days your logs keep" when retention is shorter than the range.
2. **New analytics, chosen for what an SEO team acts on:**
   - **KPI tiles:** keep the four existing tiles and add *Redirect hits (7 days)* and *404 hits (7 days)* from the same traffic response.
   - **Top redirects (range):** 5 rows, `source → target`, hit count, linking to the redirect in the drawer. This shows which old URLs still get traffic.
   - **Unused redirects:** count plus a link to the Redirects page filtered to `last_access` older than 90 days or never hit. This is the cleanup list. It needs `filterBy[unused]=90` on the redirect list query; if the existing filter can't express it, add it to `models/redirect/filter` with one integration test.
   - Skipped: referrers, user agents and per-country data. Logs already has group-by for those; add them when someone asks.
3. **Help copy is plain language and short.** Four cards, each with a title, 2–3 sentences, and a "Learn more" link to the matching page:
   - *How a redirect works:* old URL → new URL, 301 vs 302 vs 410 in one line each, "Permanent passes SEO value."
   - *Scheduling:* start and end dates, what visitors see before and after, "Ends soon" on Overview.
   - *Groups:* folders for redirects (by campaign, migration, site section). Disabling a group disables all its redirects.
   - *Chains & loops:* what they are, why Flatten helps rankings and speed.
   The copy goes through `__()` like everything else. Final wording gets a review from the marketing team before release (Task 6).
4. **Layout:** KPIs → full-width Traffic card → two columns (Top redirects | Needs attention), stacking under 782px in the `dsr` container → Help section last. Help starts open on first visit and collapses once dismissed.

## Tasks
| # | Task | Files | Tests (binding) |
|---|---|---|---|
| 1 | Numeric header alignment | `src/page/redirects/style.scss` (`.dsr-num` selector) | Live screenshot at 1440: Hits / Redirects headers right-aligned over their numbers on Redirects, Groups, Logs, 404s. Mobile card layout (≤781px) unchanged |
| 2 | Traffic endpoint | `includes/api/route/class-health.php` (`route_traffic`), `src/types/schemas/health.ts` (`TrafficResponseSchema`), `src/lib/api/hooks/use-health.ts` (`useTraffic`) | PHP integration test: 7 and 30 return 7 / 30 rows in order, gaps zero-filled, site timezone day boundaries, `days` outside {7,30} → 400, logging off → `retention.redirect === -1` and zero series, top redirects ordered by hits, permission = `CAP_REDIRECT_MANAGE`. JS: schema parses a sample response |
| 3 | Traffic chart | `src/page/overview/traffic-chart.tsx`, `style.scss` | `traffic-chart.test.tsx`: one bar group per day; toggle refetches with `days=30`; 30 disabled when retention < 30; logging-off notice links to `#/options`; hidden table lists every day's values; tooltip on focus |
| 4 | Analytics on Overview | `src/page/overview/index.tsx`, `top-redirects.tsx`, redirect list filter if needed | `index.test.tsx`: six tiles; Top redirects rows open the drawer; Unused link carries the filter; existing attention tests still pass |
| 5 | Help cards | `src/page/overview/help-cards.tsx`, `style.scss` | `help-cards.test.tsx`: four cards with links to `#/redirects`, `#/groups`; collapse persists across remount; works when `localStorage` throws |
| 6 | Live checks + copy review | none | Real site data at 1440 / 1100 / 375, light admin colour scheme; no horizontal scroll; full JS, unit and integration suites; marketing signs off on help copy |

## Open questions (defaults applied, change if wrong)
- 30-day ceiling. A 90-day view would need 90-day retention, which grows the log table. Default: 30.
- "Unused" threshold. Default: 90 days with no hit.
