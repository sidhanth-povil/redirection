# DSuite Redirects — Phase 1: Rebrand & Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Redirection fork to DSuite Redirects (main file, slug, text domain, top-level menu, visible strings, packaging) and make it impossible to crash a site by running it next to the original Redirection plugin.

**Architecture:** Changes are limited to branding. The PHP namespace `Redirection\`, `REDIRECTION_*` constants, `redirection_*` DB tables, option keys and the `redirection/v1` REST namespace stay as they are. Hard-coded `page=redirection.php` strings are first replaced with `basename( REDIRECTION_FILE )`, so renaming the main file updates the admin page slug everywhere. A pure-function guard at the top of the main file stops the plugin from loading while the original Redirection is active.

**Tech Stack:** PHP 7.4+ (WordPress plugin), PHPUnit 9 + Brain Monkey (unit), WP test suite via `@wordpress/env` (integration), React 18 + TypeScript, `@wordpress/scripts` (webpack, Jest), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-21-dsuite-redirects-design.md` (§3 Fork model and rebrand). Phases 2–8 get their own plans.

## Global Constraints

- Plugin name `DSuite Redirects`; slug and text domain `dsuite-redirects`; main file `dsuite-redirects.php`; admin page slug `dsuite-redirects.php` (it equals `basename( REDIRECTION_FILE )`).
- Admin menu: **one top-level** item titled "Redirects", dashicon `dashicons-randomize`, **no WP submenu items**.
- Do **not** change: the PHP namespace `Redirection\`, the class aliases in `redirection-refactor.php`, `REDIRECTION_*` constants, `REDIRECTION_DB_VERSION` (`4.2`), the `redirection_*` table names, option keys, the REST namespace `redirection/v1`, the JS global `Redirectioni10n`, the script handle `redirection`, or build asset names (`build/redirection.js|css`).
- Do **not** edit or delete the legacy, unreachable files (`models/`, `redirection-admin.php`, `redirection-front.php`, `redirection-cli.php`, `redirection-settings.php`, `actions/`, `matches/`, `modules/`). Unit tests still load some of them.
- Keep these visible strings, which name other plugins or formats: "SEO Redirection", "Redirect Redirection", "Redirection JSON export", "Paste redirects or a Redirection export here", "Export redirect rules in Redirection.", and the generic noun "Redirections".
- Keep the `redirection.me` documentation links. They document the same features.
- No new runtime dependencies. No AI features.
- PHP and Composer are **not installed on the host**. All PHP commands run inside `wp-env` (Docker). On macOS use BSD-compatible `sed -i ''` and `[[:space:]]`, not `\s`.

## Review Focus

1. **Original Redirection active when DSuite Redirects loads.** Expect no fatal error, DSuite stays dormant, and an error notice tells the user to deactivate Redirection. Pinned in Task 2 (unit tests) and Task 6, Step 2 (live activation).
2. **Original Redirection network-activated on multisite** (stored as keys in `active_sitewide_plugins`, not values). Expect the guard to detect it. Pinned in Task 2, `testDetectsNetworkActivatedOriginal`.
3. **An old bookmark to `tools.php?page=redirection.php&sub=404s`.** Expect a redirect to the new top-level page with `sub` kept. Without it, WP shows "Sorry, you are not allowed to access this page." Pinned in Task 3, `testLegacyUrlTarget` and `testLegacyUrlSanitisesSub`.
4. **A site switching from Redirection keeps its existing redirects.** Expect them listed and still redirecting. Pinned in Task 6, Steps 1–3.
5. **Front-end redirects still show their origin in `X-Redirect-By`** after the rename. Expect `dsuite-redirects`, and the HTTP checker still recognises our own redirects. Pinned in Task 4, Step 3, and Task 6, Step 3 (`curl -I`).

---

### Task 0: Dev environment and baseline

**Files:**
- Modify: `.wp-env.json`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: a running `wp-env` with the plugin mounted at `wp-content/plugins/dsuite-redirects`, and these scripts used by every later task: `pnpm test:unit:env`, `pnpm test:integration`, `pnpm test:js`, `pnpm lint:ts`, `pnpm lint:js`.

- [ ] **Step 1: Mount the plugin at a fixed folder name**

Replace `.wp-env.json` with:

```json
{
    "core": "WordPress/WordPress",
    "plugins": [],
    "mappings": {
        "wp-content/plugins/dsuite-redirects": "."
    },
    "env": {
        "tests": {
            "phpVersion": "8.1"
        }
    }
}
```

`mappings` gives a stable folder name whatever the clone directory is called (the current clone is `DsuiteRedirection`). Nothing is auto-activated; Task 6 activates the plugin explicitly.

- [ ] **Step 2: Point the scripts at the new folder**

In `package.json` `scripts`, replace the `test:integration` line with these two lines:

```json
"test:integration": "wp-env run cli --env-cwd=wp-content/plugins/dsuite-redirects composer run test-integration",
"test:unit:env": "wp-env run cli --env-cwd=wp-content/plugins/dsuite-redirects composer run test-unit",
```

- [ ] **Step 3: Install and start**

```bash
pnpm install
pnpm wp-env start
pnpm wp-env run cli --env-cwd=wp-content/plugins/dsuite-redirects composer install
```

Expected: `wp-env` prints `WordPress development site started at http://localhost:8888`. Composer ends with `Generating autoload files`.

- [ ] **Step 4: Record the baseline**

```bash
pnpm test:unit:env 2>&1 | tail -5
pnpm test:integration 2>&1 | tail -5
pnpm test:js 2>&1 | tail -8
pnpm lint:ts
```

Expected: every suite passes (`OK (N tests …)` / `Tests: N passed`), and `lint:ts` exits 0. **Put the three test counts in the commit message.** Every later task must keep these suites green. If anything fails on the untouched upstream code, stop and report it instead of fixing it.

- [ ] **Step 5: Commit**

```bash
git add .wp-env.json package.json
git commit -m "chore: mount plugin as dsuite-redirects in wp-env

Baseline: unit <N> ok, integration <N> ok, js <N> ok."
```

---

### Task 1: Derive the admin page slug and rename the main file

**Files:**
- Modify: `includes/plugin/class-admin.php` (4 `'redirection.php'` literals, lines ~157, ~178, ~407, ~833)
- Rename: `redirection.php` → `dsuite-redirects.php` (`git mv`)
- Modify: `phpstan.neon:4`, `rector.php:18`, `rector-max.php:20`, `phpcs.xml:13`, `package.json` (`main`, `browser`), `tests/bootstrap-integration.php:36`, `tests/unit/test-opcache-clear.php:21`, `includes/import-export/class-export-details.php:13`
- Modify: `src/page/home/index.tsx:190`, `src/page/home/error-details.tsx:22`, `src/component/redirect-edit/warning.tsx:108`

**Interfaces:**
- Produces: `REDIRECTION_FILE` now points to `dsuite-redirects.php`, so `basename( REDIRECTION_FILE ) === 'dsuite-redirects.php'` is the admin page slug that Tasks 3 and 6 rely on.

- [ ] **Step 1: Replace the slug literals in `class-admin.php` with the derived value**

The four lines become:

```php
// ~157, update_nag()
if ( $message === false || strpos( Request::get_request_url(), 'page=' . basename( REDIRECTION_FILE ) ) !== false ) {

// ~178, flying_solo()
if ( strpos( $request, 'page=' . basename( REDIRECTION_FILE ) ) !== false ) {

// ~407, redirection_head()
if ( $this->get_query( 'page' ) === basename( REDIRECTION_FILE ) && strpos( REDIRECTION_VERSION, '-beta' ) === false ) {

// ~833, inject()
if ( $page !== null && $current_page !== 'redirect' && $page === basename( REDIRECTION_FILE ) ) {
```

Verify: `grep -n "redirection\.php" includes/plugin/class-admin.php` prints nothing.

- [ ] **Step 2: Run PHP suites. Behaviour must be unchanged (main file still `redirection.php`)**

Run: `pnpm test:unit:env && pnpm test:integration`
Expected: same pass counts as the Task 0 baseline.

- [ ] **Step 3: Rename the main file and update every reference**

```bash
git mv redirection.php dsuite-redirects.php
sed -i '' 's#redirection\.php#dsuite-redirects.php#' phpstan.neon rector.php rector-max.php phpcs.xml tests/bootstrap-integration.php includes/import-export/class-export-details.php
sed -i '' "s#PLUGIN_PATH . '/redirection.php'#PLUGIN_PATH . '/dsuite-redirects.php'#" tests/unit/test-opcache-clear.php
sed -i '' 's#"redirection\.php"#"dsuite-redirects.php"#g' package.json
sed -i '' 's#page=redirection\.php#page=dsuite-redirects.php#' src/page/home/index.tsx src/page/home/error-details.tsx
sed -i '' 's#tools\.php?page=redirection\.php#admin.php?page=dsuite-redirects.php#' src/component/redirect-edit/warning.tsx
```

Check what's left:

```bash
grep -rn "redirection\.php" --include='*.php' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.xml' --include='*.neon' . \
  | grep -v node_modules | grep -v /vendor/ \
  | grep -v "^./models\|^./redirection-admin\|^./redirection-front\|^./redirection-cli\|^./redirection-settings\|seo-redirection\|fake-redirection\|'redirection/redirection.php'\|import-results.test"
```

Expected: no output. The excluded hits are legacy files, other plugins' importer names, and test fixtures whose value doesn't matter.

- [ ] **Step 4: Run all suites**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js && pnpm lint:ts`
Expected: all pass with the baseline counts.

- [ ] **Step 5: Commit**

```bash
git add -A includes/plugin/class-admin.php dsuite-redirects.php redirection.php phpstan.neon rector.php rector-max.php phpcs.xml package.json tests/bootstrap-integration.php tests/unit/test-opcache-clear.php includes/import-export/class-export-details.php src/page/home/index.tsx src/page/home/error-details.tsx src/component/redirect-edit/warning.tsx
git commit -m "refactor: rename main file to dsuite-redirects.php and derive page slug"
```

---

### Task 2: Coexistence guard

**Files:**
- Create: `includes/core/coexistence.php`
- Modify: `dsuite-redirects.php` (guard inserted right after the header comment, **before** the first `define`)
- Modify: `tests/unit/test-opcache-clear.php` (stubs for the guard's WP calls)
- Test: `tests/unit/test-coexistence.php`

**Interfaces:**
- Produces:
  - `dsr_original_redirection_active( array $active_plugins, array $network_plugins ): bool`: pure, no WP calls. `$active_plugins` is a list of basenames (`get_option('active_plugins')`). `$network_plugins` is basename ⇒ timestamp (`get_site_option('active_sitewide_plugins')`).
  - `dsr_coexistence_notice(): void`: echoes the admin error notice.
  - Constant `DSR_ORIGINAL_BASENAME = 'redirection/redirection.php'`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/test-coexistence.php`:

```php
<?php

require_once PLUGIN_PATH . '/includes/core/coexistence.php';

class CoexistenceTest extends TestCase {
	public function testInactiveWhenNothingActive() {
		$this->assertFalse( dsr_original_redirection_active( [], [] ) );
	}

	public function testIgnoresOurOwnPlugin() {
		$this->assertFalse( dsr_original_redirection_active( [ 'dsuite-redirects/dsuite-redirects.php' ], [] ) );
	}

	public function testDetectsSiteActivatedOriginal() {
		$active = [ 'akismet/akismet.php', 'redirection/redirection.php' ];

		$this->assertTrue( dsr_original_redirection_active( $active, [] ) );
	}

	public function testDetectsNetworkActivatedOriginal() {
		$network = [ 'redirection/redirection.php' => 1700000000 ];

		$this->assertTrue( dsr_original_redirection_active( [], $network ) );
	}

	public function testIgnoresSimilarlyNamedPlugins() {
		$active = [ 'seo-redirection/seo-redirection.php', 'redirection-pro/redirection.php' ];

		$this->assertFalse( dsr_original_redirection_active( $active, [] ) );
	}
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm test:unit:env -- --filter CoexistenceTest`
Expected: FAIL, `Failed opening required '.../includes/core/coexistence.php'`.

- [ ] **Step 3: Implement**

Create `includes/core/coexistence.php`:

```php
<?php
/**
 * Guard against running alongside the original Redirection plugin.
 *
 * Both plugins declare the same global functions and constants, so loading both is a fatal error.
 * This file must stay free of anything else so the main plugin file can include it before any
 * declarations.
 */

const DSR_ORIGINAL_BASENAME = 'redirection/redirection.php';

/**
 * @param string[]           $active_plugins  Value of the `active_plugins` option.
 * @param array<string, int> $network_plugins Value of the `active_sitewide_plugins` site option.
 * @return bool
 */
function dsr_original_redirection_active( array $active_plugins, array $network_plugins ) {
	return in_array( DSR_ORIGINAL_BASENAME, $active_plugins, true ) || array_key_exists( DSR_ORIGINAL_BASENAME, $network_plugins );
}

/**
 * @return void
 */
function dsr_coexistence_notice() {
	echo '<div class="notice notice-error"><p>' . esc_html__( 'DSuite Redirects is paused. Deactivate the Redirection plugin to use it. Your redirects will carry over.', 'dsuite-redirects' ) . '</p></div>';
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `pnpm test:unit:env -- --filter CoexistenceTest`
Expected: `OK (5 tests, 5 assertions)`.

- [ ] **Step 5: Wire the guard into the main file**

In `dsuite-redirects.php`, insert directly after the header comment's closing `*/`, above `define( 'REDIRECTION_DB_VERSION', … )`:

```php
require_once __DIR__ . '/includes/core/coexistence.php';

if ( dsr_original_redirection_active( (array) get_option( 'active_plugins', [] ), is_multisite() ? (array) get_site_option( 'active_sitewide_plugins', [] ) : [] ) ) {
	add_action( 'admin_notices', 'dsr_coexistence_notice' );
	add_action( 'network_admin_notices', 'dsr_coexistence_notice' );
	return;
}
```

Why this way and not refusing activation (the spec's wording): our basename sorts before `redirection/…`, so WP loads us first. Returning early lets the original load cleanly. If the original is activated while we're running, WP's activation sandbox hits the duplicate-declaration fatal error and refuses that activation. Either way the site never crashes.

- [ ] **Step 6: Stub the guard's WP calls in the opcache test, which `require`s the main file**

In `tests/unit/test-opcache-clear.php`, add to the `Functions\stubs( [ … ] )` array:

```php
				'get_option' => [],
				'is_multisite' => false,
```

- [ ] **Step 7: Run all PHP suites**

Run: `pnpm test:unit:env && pnpm test:integration`
Expected: baseline counts + 5 new unit tests, all passing.

- [ ] **Step 8: Commit**

```bash
git add includes/core/coexistence.php dsuite-redirects.php tests/unit/test-coexistence.php tests/unit/test-opcache-clear.php
git commit -m "feat: stay dormant while the original Redirection plugin is active"
```

---

### Task 3: Top-level admin menu and legacy URL redirect

**Files:**
- Modify: `includes/plugin/class-admin.php`: constructor (~line 58), `get_plugin_url()` (~line 316), `admin_menu()` (~line 591)
- Test: `tests/integration/core/test-admin-menu.php`

**Interfaces:**
- Consumes: the `basename( REDIRECTION_FILE ) === 'dsuite-redirects.php'` slug from Task 1.
- Produces:
  - `Admin::get_legacy_redirect( string $pagenow, array $query ): ?string`: public static. Returns the new admin URL for an old `tools.php?page=redirection.php` request, otherwise `null`.
  - The admin page lives at `admin.php?page=dsuite-redirects.php`. `Redirectioni10n.pluginRoot` follows automatically because it comes from `get_plugin_url()`.

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/core/test-admin-menu.php`:

```php
<?php

use Redirection\Plugin\Admin;

require_once ABSPATH . 'wp-admin/includes/plugin.php';

class AdminMenuTest extends WP_UnitTestCase {
	public function tearDown(): void {
		global $menu, $submenu;
		$menu = [];
		$submenu = [];
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	public function testRegistersTopLevelMenuWithoutSubmenu() {
		global $menu, $submenu;
		$menu = [];
		$submenu = [];
		wp_set_current_user( $this->factory->user->create( [ 'role' => 'administrator' ] ) );

		( new Admin() )->admin_menu();

		$entries = array_values( array_filter( $menu, fn( $item ) => $item[2] === 'dsuite-redirects.php' ) );
		$this->assertCount( 1, $entries, 'top-level menu item missing' );
		$this->assertSame( 'Redirects', $entries[0][0] );
		$this->assertSame( 'dashicons-randomize', $entries[0][6] );
		$this->assertArrayNotHasKey( 'tools.php', $submenu );
		$this->assertArrayNotHasKey( 'dsuite-redirects.php', $submenu );
	}

	public function testLegacyUrlTarget() {
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php&sub=404s' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php', 'sub' => '404s' ] )
		);
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php' ] )
		);
	}

	public function testLegacyUrlIgnoresOtherPages() {
		$this->assertNull( Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'other.php' ] ) );
		$this->assertNull( Admin::get_legacy_redirect( 'admin.php', [ 'page' => 'redirection.php' ] ) );
		$this->assertNull( Admin::get_legacy_redirect( 'tools.php', [] ) );
	}

	public function testLegacyUrlSanitisesSub() {
		$this->assertSame(
			admin_url( 'admin.php?page=dsuite-redirects.php&sub=scriptalert1script' ),
			Admin::get_legacy_redirect( 'tools.php', [ 'page' => 'redirection.php', 'sub' => '<script>alert(1)</script>' ] )
		);
	}
}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm test:integration -- --filter AdminMenuTest`
Expected: FAIL. The menu test fails with `top-level menu item missing`; the others fail with `Call to undefined method Redirection\Plugin\Admin::get_legacy_redirect()`.

- [ ] **Step 3: Implement**

In `includes/plugin/class-admin.php`, replace `admin_menu()` and add the two new methods directly after it:

```php
	/**
	 * @return void
	 */
	public function admin_menu() {
		$hook = add_menu_page(
			__( 'DSuite Redirects', 'redirection' ),
			__( 'Redirects', 'redirection' ),
			Capabilities::get_plugin_access(),
			basename( REDIRECTION_FILE ),
			[ $this, 'admin_screen' ],
			'dashicons-randomize'
		);
		add_action( 'load-' . $hook, [ $this, 'redirection_head' ] );
	}

	/**
	 * Map an old Tools → Redirection URL to the new top-level page.
	 *
	 * @param string               $pagenow Current admin file, e.g. `tools.php`.
	 * @param array<string, mixed> $query   Request query vars.
	 * @return string|null New URL, or null when this is not a legacy request.
	 */
	public static function get_legacy_redirect( $pagenow, array $query ) {
		if ( $pagenow !== 'tools.php' || ( $query['page'] ?? '' ) !== 'redirection.php' ) {
			return null;
		}

		$url = 'admin.php?page=' . basename( REDIRECTION_FILE );
		$sub = isset( $query['sub'] ) ? sanitize_key( (string) $query['sub'] ) : '';

		return admin_url( $sub === '' ? $url : $url . '&sub=' . $sub );
	}

	/**
	 * @return void
	 */
	public function redirect_legacy_page() {
		global $pagenow;

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only redirect
		$target = self::get_legacy_redirect( (string) $pagenow, wp_unslash( $_GET ) );

		if ( $target !== null ) {
			wp_safe_redirect( $target );
			exit;
		}
	}
```

The text domain is still `'redirection'` here on purpose; Task 4 switches every call at once.

Replace the body of `get_plugin_url()`:

```php
	private function get_plugin_url() {
		return admin_url( 'admin.php?page=' . basename( REDIRECTION_FILE ) );
	}
```

In the constructor, directly after `add_action( 'admin_menu', [ $this, 'admin_menu' ] );`, add:

```php
		add_action( 'admin_init', [ $this, 'redirect_legacy_page' ] );
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `pnpm test:integration -- --filter AdminMenuTest`
Expected: `OK (4 tests, …)`.

- [ ] **Step 5: Run all suites**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add includes/plugin/class-admin.php tests/integration/core/test-admin-menu.php
git commit -m "feat: top-level Redirects menu and redirect old Tools URL"
```

---

### Task 4: Text domain and X-Redirect-By

**Files:**
- Modify: every `.php` under `includes/` plus `dsuite-redirects.php` and `redirection-capabilities.php` (i18n calls, 120 hits)
- Modify: every `.ts`/`.tsx` under `src/` (i18n calls, about 851 hits)
- Modify: `dsuite-redirects.php` (header `Text Domain`, `load_plugin_textdomain`)
- Modify: `includes/plugin/class-admin.php:~452` (`wp_set_script_translations`)

**Interfaces:**
- Produces: the text domain `dsuite-redirects` in all live code, and `X-Redirect-By: dsuite-redirects` on front-end redirects.

- [ ] **Step 1: Sweep PHP**

In live PHP, the pattern `'redirection' )` appears only as:
- the i18n domain argument
- the third argument of `wp_redirect`/`wp_safe_redirect` (the `X-Redirect-By` value)
- the agent check `$agent === 'redirection' )`
- the second argument of `wp_set_script_translations`

All four should become `dsuite-redirects`, so one sweep does it:

```bash
grep -rlE "'redirection' ?\)" includes dsuite-redirects.php redirection-capabilities.php \
  | xargs sed -i '' -E "s/'redirection' ?\)/'dsuite-redirects' )/g"
```

Verify: `grep -rnE "'redirection' ?\)" includes dsuite-redirects.php redirection-capabilities.php` prints nothing.

- [ ] **Step 2: Sweep JS**

Single-line calls end with `'redirection' )`. Multi-line calls put the domain alone on a line (e.g. `src/page/home/error-details.tsx:18`).

```bash
grep -rlE "'redirection'([[:space:]]?\)|,?$)" src --include='*.ts' --include='*.tsx' \
  | xargs sed -i '' -E "s/'redirection'([[:space:]]?\))/'dsuite-redirects'\1/g; s/^([[:space:]]*)'redirection'(,?)$/\1'dsuite-redirects'\2/"
```

Verify the second expression only touched i18n calls. Each line printed must sit right after a `__(`/`_x(`/`_n(`/`sprintf(` argument list:

```bash
git diff -U3 src | grep -B3 -E "^\+[[:space:]]*'dsuite-redirects',?$" | grep -E "^[ +-]" | head -60
```

Then confirm nothing is left (test files excluded, since their fixture strings don't matter):

```bash
grep -rnE "'redirection'" src --include='*.ts' --include='*.tsx' | grep -v "\.test\."
```

Expected: no output. (`src/component/http-check/details.tsx:121`, `agent.value.toLowerCase() === 'redirection' )`, was converted by the first expression, which is what we want.)

- [ ] **Step 3: Check the X-Redirect-By pairing (Review Focus 5)**

```bash
grep -n "wp_redirect\|wp_safe_redirect" includes/action/class-url.php includes/plugin/class-permalinks.php includes/module/class-plugin.php
grep -n "agent ===\|toLowerCase() ===" includes/module/class-plugin.php src/component/http-check/details.tsx
```

Expected: every redirect call passes `'dsuite-redirects'` as its third argument, and both comparisons compare against `'dsuite-redirects'`.

- [ ] **Step 4: Header, textdomain loader, script handle**

In `dsuite-redirects.php`:
- `Text Domain: redirection` → `Text Domain: dsuite-redirects`
- `load_plugin_textdomain( 'redirection', …` → `load_plugin_textdomain( 'dsuite-redirects', …`

In `includes/plugin/class-admin.php`, the sweep turned `wp_set_script_translations( 'redirection', 'redirection' )` into `wp_set_script_translations( 'redirection', 'dsuite-redirects' )`. Confirm the first argument (the script handle) is **still** `'redirection'`:

```bash
grep -n "wp_set_script_translations" includes/plugin/class-admin.php
```

Expected: `wp_set_script_translations( 'redirection', 'dsuite-redirects' );`

- [ ] **Step 5: Run all suites and lint**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js && pnpm lint:ts && pnpm lint:js`
Expected: all pass. If Jest snapshots fail only because of the domain string, run `pnpm test:js -- -u` and check the snapshot diff contains only domain changes.

- [ ] **Step 6: Commit**

```bash
git add -A includes src dsuite-redirects.php redirection-capabilities.php
git commit -m "refactor: switch text domain and X-Redirect-By to dsuite-redirects"
```

---

### Task 5: Visible brand strings and packaging

**Files:**
- Modify: `dsuite-redirects.php` (header)
- Modify: brand strings in `includes/**/*.php` and `src/**/*.tsx` (list below)
- Modify: `includes/plugin/class-admin.php` (help tab title, ~line 572)
- Modify: `package.json`, `composer.json`, `readme.txt`

**Interfaces:**
- Produces: release zip `release/dsuite-redirects.zip` containing the folder `dsuite-redirects/`.

- [ ] **Step 1: Plugin header**

Replace the header comment of `dsuite-redirects.php` with:

```php
<?php
/*
Plugin Name: DSuite Redirects
Description: Manage redirects, schedule campaign redirects and catch 404s, built for marketing teams. Based on Redirection by John Godley.
Version: 5.10.1
Author: DSuite
Text Domain: dsuite-redirects
Requires PHP: 7.4
Requires at least: 6.7
License: GPLv3
============================================================================================================
For full license details see license.txt
============================================================================================================
*/
```

Keep `Version` equal to `REDIRECTION_VERSION`. The original credit stays in the description (GPL attribution).

- [ ] **Step 2: Find the brand strings**

```bash
grep -rnE "__\([[:space:]]?'[^']*Redirection[^']*'" includes src \
  | grep -v "Redirections\|SEO Redirection\|Redirect Redirection\|Redirection JSON export\|a Redirection export here\|Export redirect rules in Redirection"
```

- [ ] **Step 3: Edit each printed string in the editor using this table**

| Current string (prefix) | New |
|---|---|
| `Welcome to Redirection 🚀🎉` | `Welcome to DSuite Redirects 🚀🎉` |
| `Upgrading Redirection` | `Upgrading DSuite Redirects` |
| `The Redirection plugin encountered an error and could not load properly.` | `DSuite Redirects encountered an error and could not load properly.` |
| `Redirection plugin error` | `DSuite Redirects error` |
| `Something went wrong when upgrading Redirection.` | `Something went wrong when upgrading DSuite Redirects.` |
| `Something went wrong when installing Redirection.` | `Something went wrong when installing DSuite Redirects.` |
| `Setting up Redirection` | `Setting up DSuite Redirects` |
| `Redirection Support` | `DSuite Redirects Support` |
| `Redirection requires WordPress v%1$1s, you are using v%2$2s - please update your WordPress` | `DSuite Redirects requires WordPress v%1$1s, you are using v%2$2s - please update your WordPress` |
| `Redirection is now installed!` | `DSuite Redirects is now installed!` |
| `Redirection database needs upgrading` | `DSuite Redirects database needs upgrading` |
| `Please complete your <a href="%s">Redirection setup</a> to activate the plugin.` | `Please complete your <a href="%s">DSuite Redirects setup</a> to activate the plugin.` |
| `Redirection\'s database needs to be updated - <a href="%1$1s">click to update</a>.` | `DSuite Redirects needs a database update - <a href="%1$1s">click to update</a>.` |
| `Install Redirection tables` | `Install DSuite Redirects tables` |
| `Full documentation can be found on the {{link}}Redirection website.{{/link}}` | `Full documentation can be found in the {{link}}Redirection documentation.{{/link}}` |
| `You can find full documentation about using Redirection on the <a href="%s" target="_blank">redirection.me</a> support site.` | `You can find full documentation about using DSuite Redirects on the <a href="%s" target="_blank">redirection.me</a> support site.` |
| `Delete Redirection` | `Delete DSuite Redirects` |
| `Decide how Redirection updates itself, if needed.` | `Decide how DSuite Redirects updates its database, if needed.` |
| `Cached Redirection detected` | `Cached DSuite Redirects detected` |
| `Redirected by Redirection.` (2 hits) | `Redirected by DSuite Redirects.` |
| `<code>Redirectioni10n</code> is not defined. This usually means another plugin is blocking Redirection from loading. Please disable all plugins and try again.` | same text with `blocking DSuite Redirects from loading` (keep `Redirectioni10n`) |
| `'Redirection'` as a whole string (3 hits) | `'DSuite Redirects'` |

Help tab, in `add_help_tab()` of `includes/plugin/class-admin.php`: `'title' => 'Redirection',` → `'title' => 'DSuite Redirects',`.

Re-run the Step 2 grep. Expected: no output.

- [ ] **Step 4: Packaging**

`package.json`:
- `"name": "redirection"` → `"name": "dsuite-redirects"`
- `"description"` → `"DSuite Redirects: redirect manager for marketing teams. Fork of Redirection."`
- `"author": "John Godley"` → `"author": "DSuite (fork of Redirection by John Godley)"`
- In the `plugin` script, replace both occurrences of `release/redirection` with `release/dsuite-redirects`
- `"plugin:zip"` → `"pnpm plugin && cd release && zip -r dsuite-redirects.zip dsuite-redirects"`
- Delete the `"release:svn"` script (no wp.org)

`composer.json`: `"name"` → `"dsuite/dsuite-redirects"`.

`readme.txt`: first line `=== Redirection ===` → `=== DSuite Redirects ===`. Replace the one-line short description that follows the header fields with `Redirect manager for marketing teams. Fork of Redirection by John Godley.`

- [ ] **Step 5: Build the release zip and inspect it**

```bash
pnpm plugin:zip && unzip -l release/dsuite-redirects.zip | grep -E "dsuite-redirects/(dsuite-redirects\.php|build/redirection\.js|includes/core/coexistence\.php)$"
```

Expected: 3 matching lines.

- [ ] **Step 6: Run all suites and lint**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js && pnpm lint:ts && pnpm lint:js`
Expected: all pass. Update Jest snapshots only where the diff is a brand-word change (`pnpm test:js -- -u`, then review the diff).

- [ ] **Step 7: Commit**

```bash
git add -A includes src dsuite-redirects.php package.json composer.json readme.txt
git commit -m "feat: DSuite Redirects branding and release packaging"
```

---

### Task 6: End-to-end smoke test in wp-env

**Files:** none (verification only). If a step fails, fix it in the task that owns the code, re-run that task's tests, then come back.

- [ ] **Step 1: Simulate a site already on Redirection, with one redirect**

```bash
pnpm wp-env run cli wp plugin install redirection --activate
pnpm wp-env run cli wp redirection database install
pnpm wp-env run cli wp eval 'Red_Item::create( [ "url" => "/smoke-old", "action_data" => [ "url" => "/hello-world/" ], "match_type" => "url", "action_type" => "url", "action_code" => 301, "group_id" => 1 ] );'
```

Expected: each command exits 0.

- [ ] **Step 2: Activate DSuite while the original is still active. No crash**

```bash
pnpm wp-env run cli wp plugin activate dsuite-redirects
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/wp-admin/
```

Expected: the activation succeeds and the admin returns `302` (login redirect), not `500`. Log in at `http://localhost:8888/wp-admin` (admin / password). The red notice "DSuite Redirects is paused…" is visible.

- [ ] **Step 3: Switch over and check the existing redirect still works**

```bash
pnpm wp-env run cli wp plugin deactivate redirection
curl -sI http://localhost:8888/smoke-old | grep -iE "^(HTTP|location|x-redirect-by)"
```

Expected:

```
HTTP/1.1 301 Moved Permanently
Location: http://localhost:8888/hello-world/
X-Redirect-By: dsuite-redirects
```

- [ ] **Step 4: Admin checks in the browser**

- The WP left menu has a top-level **Redirects** item with the randomize icon and no submenu. Tools has no Redirection entry.
- `http://localhost:8888/wp-admin/tools.php?page=redirection.php&sub=404s` lands on `admin.php?page=dsuite-redirects.php&sub=404s`.
- The Redirects list shows `/smoke-old`.
- Titles and the support screen say "DSuite Redirects".
- The browser console shows no errors.

- [ ] **Step 5: Clean up the test site**

```bash
pnpm wp-env run cli wp plugin delete redirection
```

- [ ] **Step 6: Final run**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js && pnpm lint:ts && pnpm lint:js`
Expected: all green. Commit only if something was fixed during the smoke test (`fix: <what>`).

---

## Next

Once Phase 1 is merged, write `docs/superpowers/plans/<date>-phase2-design-system-shell.md` against the code as it stands then (spec §4.2–4.4, §9 step 2).
