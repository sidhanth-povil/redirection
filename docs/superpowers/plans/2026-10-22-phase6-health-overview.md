# Phase 6: Health and Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. RED → GREEN per task; the named tests are the binding contract.

**Goal:** A marketer lands on Overview, sees what's broken (new 404s, chains, loops, expiring redirects), and fixes each item in about 2 clicks. The drawer warns about chains, loops and duplicates before saving.

**Architecture:**
- `Redirection\Health\Chains` is pure (no WordPress). It takes edges `{id, source key, target key, target, hits}` and finds chains (2+ hops) and loops, and walks a candidate edge for `/check`.
- `Chains::load()` builds the edges from enabled, live, plain (`regex = 0`) `url`/`url` redirects with a local target. The source key is the stored `match_url`. The target key is `Matcher( local path )->get_url()`, the same normaliser upstream uses for `match_url`.
- `Redirection\Api\Route\Health` registers `GET /health` and `POST /check` with the manage capability.
- Overview (`src/page/overview`) shows the KPI tiles and the attention list. It reuses `RedirectDrawer` for Fix/Extend, and flattens with the existing update route via `toPayload( setTarget( createState( item ), final ) )`.
- The drawer runs a debounced `/check` (`src/page/redirects/precheck.tsx`) and blocks saving on a loop.

**Spec:** §4.5 Overview and drawer pre-save check, §5.4, §7, §8 (chain engine cases), §9 step 6.

## Global Constraints
- No cache, and regex/wildcard redirects are skipped (spec `ponytail:` notes, repeated in code).
- Read-only routes use the existing manage capability and the REST nonce; there's no flatten endpoint (§5.4).
- Earlier phases' constraints apply: `.dsr-` scoped CSS, no new runtime dependencies, Jest tests import jest-dom.

## Decisions
1. **Keys are case- and slash-insensitive** (upstream `match_url` form). A case-sensitive redirect whose target differs only in case is reported as a chain. `ponytail:` acceptable over-report; honour per-redirect flags if it shows up.
2. **Every redirect whose target is itself redirected is reported as a chain** (not just the head), so flattening each one leaves no chains behind. Loops are reported once per cycle; a redirect that leads into a loop counts as a loop.
3. **A source matched by several plain redirects keeps the first by position, then id** (upstream match order).
4. **Overview's sidebar default:** `overview` becomes the default route. Old `?sub=`-less links that have filters still go to Redirects.
5. **`/check` order:** loop (blocks save) → duplicate → chain → ok. A source with `*` or the regex flag returns `ok` unchecked.
6. **Attention:** loops first, then by hits. 404s from the last 7 days, top 10 by hits, excluding URLs a live redirect now matches. Expiring = enabled redirects ending within 7 days.

## Tasks
| # | Task | Files | Tests (binding) |
|---|---|---|---|
| 1 | Chain engine | `includes/health/class-chains.php` | `tests/unit/test-chains.php`: simple chain, long chain (each member reported, same final target), loop, self-loop, lead-in to loop, no chain for single hop; `check()`: ok, chain, loop back to source, duplicate, edited id ignored |
| 2 | Loader + REST | `class-chains.php` (`load`), `includes/api/route/class-health.php`, `class-api.php` | `tests/integration/api/test-health.php`: case/trailing-slash normalisation links a chain; absolute same-host target counts, external doesn't; regex/wildcard/disabled/expired ignored; `/health` counts + attention (404 top, fixed 404 excluded, expiring); `/check` statuses; unauthorised → 403 |
| 3 | Overview | `app/router.ts`, `page/home/page-content.tsx`, `page/overview/*`, `lib/api` (health/check), `types` | router: `overview` default and access via `redirect`; legacy filter links still → redirects. overview: tiles, empty state, Fix opens drawer prefilled, Flatten calls update with the final target, no Flatten on loops |
| 4 | Drawer pre-save check | `page/redirects/precheck.tsx`, `redirect-drawer.tsx` | chain shows "Point straight to" and applies it; loop blocks Save; duplicate links to it; wildcard/regex skip the check |
| 5 | Live checks | none | Create A→B, B→C in the drawer (check warns on the second); Overview shows the chain; Flatten → A→C; `curl` A gives one hop; full suites |
