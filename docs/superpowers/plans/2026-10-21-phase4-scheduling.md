# Phase 4: Scheduled and Expiring Redirects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps follow RED → GREEN per task; the tests named in each task are the binding contract.

**Goal:** Campaign redirects can start and/or end on set dates and switch on and off by themselves. Marketers see Scheduled/Expired badges and filters, and set dates in the drawer.

**Architecture:**
- `dsr_db_version` 1 adds `start_at`/`end_at` (UTC `DATETIME NULL`) plus a `schedule` key to `redirection_items`. The change is made by `Redirection\Database\DsrUpgrader`, which runs on `admin_init`. Upstream's `REDIRECTION_DB_VERSION` is never touched.
- `Redirection\Redirect\Schedule` holds the pure rules: parsing, validation, the active window and the state.
- Matching applies the window in PHP to the candidate rows that the existing lookup already fetches, and marks the URL as uncacheable whenever any candidate has a schedule.
- The REST/JSON format is ISO 8601 with the site's UTC offset. Input with no offset is read in the site timezone; the database stores UTC.

**Spec:** `docs/superpowers/specs/2026-10-21-dsuite-redirects-design.md` §5.1, §6, §7, §8, §9 step 4.

## Global Constraints
- UTC in the DB; `NULL` = unbounded; `end_at` must be later than `start_at` or REST returns 400 (`redirect_schedule`) (§5.1).
- Never bump `REDIRECTION_DB_VERSION`; DSuite schema is tracked in `dsr_db_version`. If the upgrader fails it logs to `error_log`, leaves the version unchanged and retries on the next admin load. Matching never assumes the columns exist before version 1 (§3, §6).
- A scheduled redirect is never served from, or written to, the redirect cache (§5.1).
- Apache/Nginx output skips redirects that have any schedule (§5.1).
- All Phase 2/3 constraints apply: `.dsr-` scoped CSS in `style.scss` files, no new runtime dependencies, PHP tests in `tests-cli`, Jest tests import jest-dom.

## Decisions this plan makes
1. **The window is checked in PHP, not in the SQL `WHERE`.** If SQL filtered out future-start rows, the cache guard couldn't see them. The cache would then keep a catch-all match (or an empty result for an hour) after a scheduled redirect should have started. The candidate set is at most `MAX_REDIRECTS` rows, so the cost is nil. The spec's `schedule` index still backs the admin filters.
2. **API dates are ISO 8601 with offset**, e.g. `2026-11-28T00:00:00+05:30`. Exports therefore stay portable between sites, and the drawer's `datetime-local` value is the first 16 characters.
3. **Update keeps the schedule when the request omits it.** Only `start_at`/`end_at` keys that are present are written, so upstream callers that don't know about schedules (imports, older forms) never clear one.
4. **The "N scheduled redirects are not included" note in the export UI moves to Phase 8**, when the Import/Export page is restyled. The skip itself ships now.
5. **"Live" chip** = `status=enabled` + `schedule=live` (no schedule, or inside the window). Other chips: Scheduled = start in the future; Expired = end in the past; Disabled = `status=disabled`.

## Review Focus
1. **Window boundaries:** a redirect is active from `start_at` (inclusive) to `end_at` (exclusive), in UTC, whatever the site timezone. Pinned in Task 1 unit tests and Task 3 integration (`only matches inside its window`).
2. **Cache:** with the cache on, a catch-all match must not hide a scheduled exact redirect once it starts. Pinned in Task 3 (`does not cache lookups with scheduled candidates`).
3. **Fresh and reinstalled sites:**
   - columns missing → matching and saving still work;
   - reinstalling tables → the option is reset, so the upgrader runs again.

   Pinned in Task 2.
4. **Timezones:** a date typed in the drawer is stored as the correct UTC instant and shown back unchanged. Pinned in Task 1 (`reads offset-less input in the site timezone`) and Task 5 (live check).
5. **Editing in an older client keeps the schedule.** Pinned in Task 3 (`update without schedule keys keeps it`).

## Tasks

| # | Task | Files | Tests (binding) |
|---|---|---|---|
| 1 | `Schedule` rules | `includes/redirect/class-schedule.php` | `tests/unit/test-schedule.php`: parse ISO-with-offset → UTC; offset-less → site tz; empty → null; garbage → error; end ≤ start → `redirect_schedule` error; `is_active` start inclusive / end exclusive / open ends; `state` none/scheduled/live/expired; `to_site_iso` round-trips |
| 2 | DSR upgrader | `includes/database/class-dsr-upgrader.php`; hook in `Admin` constructor; `Latest::remove()` deletes the option; test bootstrap runs it | `tests/integration/database/test-dsr-upgrader.php`: adds columns + `schedule` key on a 4.2 schema and sets the option to 1; running twice is safe; does nothing when already at 1 |
| 3 | Server: model, matching, cache, filters, server-config skip | `class-redirect.php` (load, getters, `to_json` `start_at`/`end_at`/`schedule_state`, `to_sql`, `get_for_matched_url` window + cache mark), `class-cache.php` (`mark_uncacheable`), `class-sanitize.php` (schedule keys), `class-filters.php` (`schedule` filter), `format/class-apache.php` + `class-nginx.php` (skip) | `tests/integration/redirect/test-schedule-redirects.php`: only matches inside its window; does not cache lookups with scheduled candidates; create via REST returns `schedule_state` + ISO dates; end ≤ start → 400; update without schedule keys keeps it; `schedule` filter scheduled/expired/live; Apache and Nginx output skips scheduled |
| 4 | Drawer + list UI | `types/schemas/redirect.ts`, `page/redirects/model.ts` (+ schedule fields/validation), `describe.ts` (`scheduleBadge`), `redirect-drawer.tsx` (toggle + dates + tz hint), `redirect-table.tsx` (badge), `index.tsx` (chips), `class-admin.php` (`timezone` in `Redirectioni10n`) | model: reads/writes schedule, `''` → `null`, blocks end ≤ start; describe: Starts/Until/Expired badges; drawer: toggle reveals dates, invalid range shows an error and disables save, payload carries dates; page: Scheduled/Expired chips set `filterBy.schedule`, Live sets status+schedule |
| 5 | Live checks | none | Schedule a redirect a few minutes ahead → 404 now, 301 after start (no cron); end in the past → Expired badge and 404; cache on → still correct; drawer round-trips the dates in a non-UTC site timezone; Apache export omits it; full suites |

## Next
Phase 5: wildcards (`flag_wildcard`, `Wildcard` class, matcher hook, drawer badge), spec §5.2.
