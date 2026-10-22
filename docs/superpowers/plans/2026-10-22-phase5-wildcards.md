# Phase 5: Wildcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. RED → GREEN per task; the named tests are the binding contract.

**Goal:** Marketers redirect a whole section with `*`, with no regex: `/blog/*` → `/news/*` turns `/blog/2024/hello` into `/news/2024/hello`.

**Architecture:**
- `Redirection\Url\Wildcard` is pure (no WordPress) and compiles a source to an anchored regex with every literal part `preg_quote`d.
- A source containing `*`, saved with regex off, gets `flag_wildcard`. It is also stored with `regex = 1` and `match_url = 'regex'`, so upstream's existing regex lookup fetches it with no new query.
- At runtime `flag_wildcard` takes precedence over `flag_regex`:
  - `Url::is_match` compiles the source.
  - The compare classes substitute captures with `Wildcard::apply_target`.
- Server-config exports use `Redirect::get_export_source()` and `get_export_target()`, which give the compiled regex and the `*` target as `$n`.

**Spec:** §5.2, §7, §8 (wildcard unit cases), §9 step 5.

## Global Constraints
- `flag_wildcard` and `flag_regex` are mutually exclusive, and the sanitizer rejects both being set (§5.2).
- Detection happens only on save. Stored upstream rows whose plain source contains `*` keep matching literally (§5.2).
- Literal parts always go through `preg_quote`, so user input can never inject regex (§7).
- Earlier phases' constraints apply: `.dsr-` scoped CSS in `style.scss`, no new runtime dependencies, PHP tests in `tests-cli`, Jest tests import jest-dom.

## Decisions
1. **The client never sends `flag_wildcard`; the server derives it on every save** (plain source + `*`). The drawer only shows a badge. Detection lives in one place, and older clients get wildcards for free.
2. **A `*` in the target is filled from the captures in order, and extra `*`s become `''`** (spec). A target with no `*` is used as is.
3. **`_redirects` export** gets the same treatment as Apache/Nginx through the export getters, if its regex path uses `get_url()`. Otherwise wildcard redirects are skipped there and the skip is recorded in a ruling.

## Review Focus
1. **Regex injection:** a source like `/a.b/(x)*` must match only the literal `/a.b/(x)` prefix. Pinned in Task 1.
2. **Upstream rows whose plain `url` contains `*`** keep their old literal behaviour until edited. Pinned in Task 2.
3. **Editing a wildcard in the drawer** must not tick "Regular expression", and saving it unchanged must keep it a wildcard. Pinned in Task 2 (JSON) and Task 4.
4. **Case-insensitive and trailing-slash flags** still apply to wildcards; at least the case flag must be honoured. Pinned in Task 1/2.
5. **Server config output for a wildcard is valid:** compiled regex plus `$n` targets. Pinned in Task 3.

## Tasks
| # | Task | Files | Tests (binding) |
|---|---|---|---|
| 1 | `Wildcard` | `includes/url/class-wildcard.php` | `tests/unit/test-wildcard.php`: single and multiple `*`, special characters quoted, case flag, anchored; `apply_target` fills in order, extra `*`s → `''`, no `*` unchanged; `to_replacement` gives `$n` with literal `$`/`\` escaped |
| 2 | Flag, sanitizer, matching | `class-source-flags.php` (`flag_wildcard`), `class-sanitize.php` (detect/reject), `class-redirect.php` (`is_wildcard`, flag load), `url/class-url.php`, `compare/class-compare.php` + the 4 target callers | `tests/integration/redirect/test-wildcard-redirects.php`: `/blog/*` → `/news/*` end to end; multi-wildcard; special characters don't act as regex; case-insensitive; regex + wildcard both set → 400; stored upstream plain `*` row unchanged; JSON says wildcard true / regex false |
| 3 | Server-config export | `class-redirect.php` (export getters), htaccess rule builder, nginx, `_redirects` | same file: the Apache/Nginx output for `/blog/*` → `/news/*` contains the compiled regex and `$1` |
| 4 | Drawer + list | `page/redirects/model.ts` (`isWildcard`), `redirect-drawer.tsx` (hint + badge), `describe.ts` / `redirect-table.tsx` (badge) | model: `isWildcard` true for a plain `*` source and false with regex on; drawer: typing `/blog/*` shows the "Wildcard" badge, the hint is present, and ticking regex removes the badge; table: Wildcard badge |
| 5 | Live checks | none | Create `/blog/*` → `/news/*` in the drawer; `curl /blog/2024/hello` → 301 to `/news/2024/hello`; a regex redirect still works; full suites |
