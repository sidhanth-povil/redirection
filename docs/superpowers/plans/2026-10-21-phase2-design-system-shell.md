# Phase 2: Design System and App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace upstream's `?sub=` page switcher and WP-style sub-menu with the DSuite app shell: a `.dsr-` scoped design-token layer, a hash router, and a sidebar that collapses to a tab strip on narrow containers. The existing pages keep working inside it.

**Architecture:** The PHP admin page mounts one root, `<div class="wrap"><div id="dsr-app" class="dsr-app">`. `src/app/router.ts` owns the route table (`#/redirects`, `#/404s`, …) and maps each route to the upstream page names that capabilities and old `sub=` links use. Old `?sub=…` URLs are rewritten to hash URLs once at boot, so PHP links, the Phase 1 Tools redirect and bookmarks keep working without PHP changes. The old pages still read and write their table state through `getPageUrl()` and `useTableUrlSync()`. Both are redirected to the hash query, which leaves the pages themselves untouched until each is rebuilt in Phases 3–8.

**Tech Stack:** React 18 + TypeScript, SCSS via `@wordpress/scripts`, CSS container queries, Jest + Testing Library, PHPUnit integration (wp-env `tests-cli`).

**Spec:** `docs/superpowers/specs/2026-10-21-dsuite-redirects-design.md` (§4.2 hard constraints, §4.3 design system, §4.4 app shell, §9 step 2)

## Global Constraints

- The React app mounts into a single root `<div id="dsr-app" class="dsr-app">` inside the page's `.wrap`. No styles target `#adminmenu`, `#adminmenuwrap`, `#wpcontent`, `#wpbody`, `body`, `html` or bare element selectors (spec §4.2.1).
- Every new selector is prefixed `.dsr-` and nested under `.dsr-app`. No global reset, no `* {}` rules (§4.2.2).
- Responsive behaviour comes from container queries on `.dsr-app` (`container-type: inline-size`). The sidebar becomes a tab strip below a container width of 782px (§4.2.3, §4.4).
- Accent `#4f46e5`; radius 8 / 10 / 12px; spacing on a 4px base; font inherits the WP system stack (§4.3).
- Accessibility: labels, `aria-*`, keyboard support, visible focus rings, AA contrast (§4.3).
- **No new runtime dependencies** (§4.3).
- Hash routes: `#/redirects`, `#/404s`, `#/logs`, `#/site`, `#/import-export`, `#/settings`, `#/support`, with query parameters allowed, e.g. `#/redirects?new=1&from=/x` (§4.4).
- Internal PHP namespaces, tables, options and the REST namespace `redirection/v1` stay unchanged (spec §3).
- PHP tests run in `tests-cli` (`pnpm test:unit:env`, `pnpm test:integration`), never in the dev `cli` container.

## Decisions this plan makes (spec is silent or sequencing differs)

1. **Components are built when first used.** Phase 2 ships `tokens.scss` and `Button`, the only component the shell needs. `Card`, `Badge`, `Drawer`, `Combobox`, `Segmented` and `Table` land in the phase that first uses them (Phase 3 for the drawer set, Phase 6 for `Card`/`Badge` on Overview). Building them now would mean designing their props without a consumer.
2. **Default route is `#/redirects` until Phase 6.** `#/overview` is the spec's default, but Overview is built in Phase 6. Until then it would be an empty page, so it is neither registered nor shown in the sidebar.
3. **`#/groups` stays as a sidebar item.** The spec's route list has no groups route, but upstream's group management page has no other home yet. Phase 3 decides whether it folds into the Redirects page.
4. **The sidebar's 404 count badge is deferred to Phase 7.** It needs a "new 404s" count, which comes with the 404s page work.
5. **The width matrix (§4.2.6) is a scripted browser check in Task 5, not a repo test.** The existing `test:e2e` harness is HTTP-only (node-fetch) and adding a browser runner would be a new dependency. Task 5 runs the check with Chrome DevTools at 1440 / 1100 (WP menu folded) / 375px and records the results.
6. **Old in-page links (`pluginRoot + '&filterby[…]'`, `&sub=site`) are not rewritten.** They cause a full page load, and the boot rewrite turns them into hash routes. They disappear as their pages are rebuilt.

## Review Focus

1. **The native WP admin menu and other admin screens look identical to stock at every width, with no horizontal page scroll** (1440, 1100 with the menu folded, 375). Checked in Task 5, Steps 2–4, by comparing `#adminmenu` computed styles against the Dashboard and checking `scrollWidth`.
2. **Old URLs land on the right screen with their filters:**
   - the plugin list's "Settings" link (`&sub=options`)
   - the Phase 1 Tools redirect (`&sub=404s`)
   - a group row's "view redirects" link (`&filterby[group]=3`)

   Pinned in Task 2 (`legacyUrlToHashUrl` tests) and checked live in Task 5, Step 5.
3. **Download and feed URLs are not hijacked.** `sub=rss&token=…` must never be rewritten. Pinned in Task 2's `ignores server-only subs` test.
4. **A user who can only see some pages** gets a sidebar with just those routes and lands on the first allowed route when the hash names a forbidden one. Pinned in Task 2 (`allowedRoutes`, `resolveRoute`) and Task 4 (Shell renders only the given routes).
5. **Filters and paging survive reloads and back/forward.** Table state is written into the hash with `replaceState`, so filtering doesn't add history entries, and a reload restores the filtered view. Pinned in Task 3 (`useTableUrlSync` writes `#/404s?filterby%5Bip%5D=…`) and checked live in Task 5, Step 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/ui/tokens.scss` | `--dsr-*` custom properties and the container declaration on `.dsr-app` |
| `src/ui/button/index.tsx`, `style.scss` | `Button` (primary / secondary) |
| `src/ui/index.ts` | Barrel; imports `tokens.scss` once |
| `src/ui/ui.test.tsx` | Button behaviour |
| `src/app/router.ts` | Route table, hash parse/build, legacy URL rewrite, access resolution, `useRoute()` |
| `src/app/router.test.ts` | Router unit tests |
| `src/app/shell/index.tsx`, `style.scss` | Sidebar/tab-strip nav, page header, content region |
| `src/app/shell/shell.test.tsx` | Shell rendering and ARIA |
| `src/lib/wordpress-url/index.ts` (modify) | `getPageUrl()` reads the hash query and adds the legacy `sub` |
| `src/lib/hooks/use-table-url-sync.ts` (modify) | Writes table state to the hash |
| `src/lib/hooks/use-table-url-sync.test.ts` (create) | Hook writes hash |
| `src/page/home/index.tsx`, `page-content.tsx` (modify) | Use router + Shell instead of `PageRouter` + `Menu` |
| `src/index.tsx` (modify) | Mount `#dsr-app`, rewrite legacy URL once |
| `includes/plugin/class-admin.php` (modify) | Mount markup |
| `tsconfig.json`, `webpack.config.js`, `jest.config.js` (modify) | `ui` and `app` aliases |
| `e2e/util.js` (modify) | Phase 1 leftover: expect `x-redirect-by: dsuite-redirects` |

---

### Task 1: Aliases, design tokens and `Button`

**Files:**
- Modify: `tsconfig.json` (`paths`), `webpack.config.js` (`resolve.alias`, ~line 125), `jest.config.js` (`moduleNameMapper`), `e2e/util.js:21`
- Create: `src/ui/tokens.scss`, `src/ui/button/index.tsx`, `src/ui/button/style.scss`, `src/ui/index.ts`
- Test: `src/ui/ui.test.tsx`

**Interfaces:**
- Produces: `import { Button } from 'ui';` with `Button( props: ButtonProps )`, where `ButtonProps extends ButtonHTMLAttributes< HTMLButtonElement >` plus `variant?: 'primary' | 'secondary'` (default `'secondary'`). Renders `<button type="button" class="dsr-button dsr-button--{variant}">`.
- Produces: CSS custom properties on `.dsr-app` named `--dsr-accent`, `--dsr-accent-hover`, `--dsr-accent-soft`, `--dsr-accent-text`, `--dsr-surface`, `--dsr-surface-muted`, `--dsr-border`, `--dsr-border-strong`, `--dsr-text`, `--dsr-text-muted`, `--dsr-text-subtle`, `--dsr-{success|info|warning|neutral|danger}-{bg|text}`, `--dsr-radius-{sm|md|lg}`, `--dsr-space-{1|2|3|4|5|6|8}`, `--dsr-shadow-{sm|md}`, `--dsr-focus-ring`. Container name `dsr`.

- [ ] **Step 1: Add the `ui` and `app` aliases**

`tsconfig.json`, inside `compilerOptions.paths`, add after `"app/*": ["app/*"],`:

```json
			"ui": ["ui"],
			"ui/*": ["ui/*"],
```

`webpack.config.js`, inside `resolve.alias`, add after the `app:` line:

```js
			ui: path.resolve( __dirname, 'src/ui/' ),
```

`jest.config.js`, inside `moduleNameMapper`, add after the `'^types/(.*)$'` line:

```js
		'^ui$': '<rootDir>/src/ui',
		'^ui/(.*)$': '<rootDir>/src/ui/$1',
		'^app/(.*)$': '<rootDir>/src/app/$1',
```

`e2e/util.js:21` (Phase 1 leftover): change `toBe( 'redirection' )` to `toBe( 'dsuite-redirects' )`.

- [ ] **Step 2: Write the failing test**

Create `src/ui/ui.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from 'ui';

describe( 'Button', () => {
	it( 'defaults to a non-submitting secondary button', () => {
		render( <Button>Cancel</Button> );

		const button = screen.getByRole( 'button', { name: 'Cancel' } );
		expect( button ).toHaveAttribute( 'type', 'button' );
		expect( button ).toHaveClass( 'dsr-button', 'dsr-button--secondary' );
	} );

	it( 'applies the primary variant and passes through props', () => {
		const onClick = jest.fn();
		render(
			<Button variant="primary" onClick={ onClick } className="extra" aria-describedby="hint">
				Save
			</Button>
		);

		const button = screen.getByRole( 'button', { name: 'Save' } );
		button.click();

		expect( onClick ).toHaveBeenCalledTimes( 1 );
		expect( button ).toHaveClass( 'dsr-button--primary', 'extra' );
		expect( button ).toHaveAttribute( 'aria-describedby', 'hint' );
	} );

	it( 'allows a submit button', () => {
		render( <Button type="submit">Go</Button> );

		expect( screen.getByRole( 'button', { name: 'Go' } ) ).toHaveAttribute( 'type', 'submit' );
	} );
} );
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx jest src/ui`
Expected: FAIL with `Cannot find module 'ui'` (or a `src/ui` resolution error).

- [ ] **Step 4: Implement the tokens and `Button`**

Create `src/ui/tokens.scss`:

```scss
/**
 * DSuite design tokens. Scoped to the app root so nothing leaks into wp-admin.
 */
.dsr-app {
	--dsr-accent: #4f46e5;
	--dsr-accent-hover: #4338ca;
	--dsr-accent-soft: #eef2ff;
	--dsr-accent-text: #3730a3;

	--dsr-surface: #fff;
	--dsr-surface-muted: #f7f8fa;
	--dsr-border: #eceef2;
	--dsr-border-strong: #d6d9df;

	--dsr-text: #1f2430;
	--dsr-text-muted: #4b5563;
	--dsr-text-subtle: #6b7280;

	// Status: 301 = success, 302 = info, scheduled = warning, disabled = neutral, error = danger.
	--dsr-success-bg: #ecfdf5;
	--dsr-success-text: #047857;
	--dsr-info-bg: #eff6ff;
	--dsr-info-text: #1d4ed8;
	--dsr-warning-bg: #fff7ed;
	--dsr-warning-text: #c2410c;
	--dsr-neutral-bg: #f3f4f6;
	--dsr-neutral-text: #4b5563;
	--dsr-danger-bg: #fef2f2;
	--dsr-danger-text: #b91c1c;

	--dsr-radius-sm: 8px;
	--dsr-radius-md: 10px;
	--dsr-radius-lg: 12px;

	--dsr-space-1: 4px;
	--dsr-space-2: 8px;
	--dsr-space-3: 12px;
	--dsr-space-4: 16px;
	--dsr-space-5: 20px;
	--dsr-space-6: 24px;
	--dsr-space-8: 32px;

	--dsr-shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.06);
	--dsr-shadow-md: 0 6px 16px rgba(17, 24, 39, 0.08);
	--dsr-focus-ring: 0 0 0 2px #fff, 0 0 0 4px #4f46e5;

	container: dsr / inline-size;
	color: var(--dsr-text);
}
```

Create `src/ui/button/index.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import './style.scss';

export interface ButtonProps extends ButtonHTMLAttributes< HTMLButtonElement > {
	variant?: 'primary' | 'secondary';
}

export function Button( { variant = 'secondary', type = 'button', className, ...rest }: ButtonProps ) {
	const classes = [ 'dsr-button', `dsr-button--${ variant }`, className ].filter( Boolean ).join( ' ' );

	// eslint-disable-next-line react/button-has-type -- type is a prop defaulting to "button"
	return <button type={ type } className={ classes } { ...rest } />;
}
```

Create `src/ui/button/style.scss`:

```scss
.dsr-app .dsr-button {
	display: inline-flex;
	align-items: center;
	gap: var(--dsr-space-2);
	min-height: 32px;
	padding: 0 var(--dsr-space-4);
	border: 1px solid transparent;
	border-radius: var(--dsr-radius-sm);
	font: inherit;
	font-weight: 500;
	line-height: 1;
	cursor: pointer;

	&:focus-visible {
		outline: none;
		box-shadow: var(--dsr-focus-ring);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.dsr-app .dsr-button--primary {
	background: var(--dsr-accent);
	color: #fff;

	&:hover:not(:disabled) {
		background: var(--dsr-accent-hover);
	}
}

.dsr-app .dsr-button--secondary {
	background: var(--dsr-surface);
	border-color: var(--dsr-border-strong);
	color: var(--dsr-text);

	&:hover:not(:disabled) {
		background: var(--dsr-surface-muted);
	}
}
```

Create `src/ui/index.ts`:

```ts
import './tokens.scss';

export { Button } from './button';
export type { ButtonProps } from './button';
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `npx jest src/ui`
Expected: `Tests: 3 passed`.

If ESLint reports that the `react/button-has-type` disable comment is unused, delete the comment.

- [ ] **Step 6: Lint**

Run: `pnpm lint:ts && pnpm lint:js && npx wp-scripts lint-style 'src/ui/**/*.scss'`
Expected: all exit 0. If stylelint flags `container: dsr / inline-size`, replace it with the two longhands `container-name: dsr;` and `container-type: inline-size;`.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.json webpack.config.js jest.config.js e2e/util.js src/ui
git commit -m "feat: design tokens and Button in src/ui"
```

---

### Task 2: Hash router

**Files:**
- Create: `src/app/router.ts`
- Test: `src/app/router.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `app/router`):
  - `type RouteName = 'redirects' | 'groups' | '404s' | 'logs' | 'site' | 'import-export' | 'settings' | 'support'`
  - `interface Route { name: RouteName; query: Record< string, string > }`
  - `ROUTES: { name: RouteName; pages: string[] }[]`, in sidebar order
  - `DEFAULT_ROUTE: RouteName` (= `'redirects'`)
  - `getRouteLabel( name: RouteName ): string`
  - `parseHash( hash: string ): Route`
  - `buildHash( name: RouteName, query?: Record< string, string > ): string`, e.g. `'#/404s?filterby%5Bip%5D=1.2.3.4'`
  - `pageForRoute( name: RouteName ): string` (upstream page name; `'redirect'`, `'log'`, `'options'`, …)
  - `routeForPage( page: string ): RouteName`
  - `allowedRoutes( allowedPages: string[] ): RouteName[]`
  - `resolveRoute( name: RouteName, allowed: RouteName[] ): RouteName | null`
  - `legacyUrlToHashUrl( href: string ): string | null`: returns `pathname?page=…#/route?…`, or `null` when there's nothing to rewrite
  - `useRoute(): Route`: re-renders on `hashchange`

- [ ] **Step 1: Write the failing test**

Create `src/app/router.test.ts`:

```ts
import {
	allowedRoutes,
	buildHash,
	legacyUrlToHashUrl,
	pageForRoute,
	parseHash,
	resolveRoute,
	routeForPage,
} from 'app/router';

const ADMIN = 'http://example.test/wp-admin/admin.php';

describe( 'parseHash', () => {
	it( 'falls back to the default route for an empty or unknown hash', () => {
		expect( parseHash( '' ) ).toEqual( { name: 'redirects', query: {} } );
		expect( parseHash( '#/nope?x=1' ) ).toEqual( { name: 'redirects', query: {} } );
	} );

	it( 'reads the route and its query', () => {
		expect( parseHash( '#/redirects?new=1&from=%2Fx' ) ).toEqual( {
			name: 'redirects',
			query: { new: '1', from: '/x' },
		} );
		expect( parseHash( '#/404s?filterby%5Bip%5D=1.2.3.4' ) ).toEqual( {
			name: '404s',
			query: { 'filterby[ip]': '1.2.3.4' },
		} );
		expect( parseHash( '#/import-export' ) ).toEqual( { name: 'import-export', query: {} } );
	} );
} );

describe( 'buildHash', () => {
	it( 'round-trips through parseHash', () => {
		const hash = buildHash( 'logs', { orderby: 'ip', 'filterby[url]': '/a b' } );

		expect( hash.startsWith( '#/logs?' ) ).toBe( true );
		expect( parseHash( hash ) ).toEqual( { name: 'logs', query: { orderby: 'ip', 'filterby[url]': '/a b' } } );
	} );

	it( 'omits an empty query', () => {
		expect( buildHash( 'settings' ) ).toBe( '#/settings' );
	} );
} );

describe( 'page mapping', () => {
	it( 'maps routes to upstream page names and back', () => {
		expect( pageForRoute( 'redirects' ) ).toBe( 'redirect' );
		expect( pageForRoute( 'logs' ) ).toBe( 'log' );
		expect( pageForRoute( 'settings' ) ).toBe( 'options' );
		expect( routeForPage( 'export' ) ).toBe( 'import-export' );
		expect( routeForPage( 'import' ) ).toBe( 'import-export' );
		expect( routeForPage( 'unknown' ) ).toBe( 'redirects' );
	} );
} );

describe( 'access', () => {
	it( 'keeps only routes the user can see, in sidebar order', () => {
		expect( allowedRoutes( [ 'support', '404s', 'export' ] ) ).toEqual( [ '404s', 'import-export', 'support' ] );
	} );

	it( 'falls back to the first allowed route', () => {
		expect( resolveRoute( 'logs', [ '404s', 'logs' ] ) ).toBe( 'logs' );
		expect( resolveRoute( 'redirects', [ '404s', 'logs' ] ) ).toBe( '404s' );
		expect( resolveRoute( 'redirects', [] ) ).toBeNull();
	} );
} );

describe( 'legacyUrlToHashUrl', () => {
	it( 'rewrites sub pages and keeps their filters', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=404s&filterby%5Bip%5D=1.2.3.4' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/404s?filterby%5Bip%5D=1.2.3.4'
		);
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=options' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/settings'
		);
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=log' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/logs'
		);
	} );

	it( 'treats filters without a sub as the redirects page', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&filterby%5Bgroup%5D=3' ) ).toBe(
			'/wp-admin/admin.php?page=dsuite-redirects.php#/redirects?filterby%5Bgroup%5D=3'
		);
	} );

	it( 'leaves plain, already-hashed and server-only URLs alone', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php' ) ).toBeNull();
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=log#/404s' ) ).toBeNull();
	} );

	it( 'ignores server-only subs', () => {
		expect( legacyUrlToHashUrl( ADMIN + '?page=dsuite-redirects.php&sub=rss&module=1&token=abc' ) ).toBeNull();
	} );
} );
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/app/router`
Expected: FAIL with `Cannot find module 'app/router'`.

- [ ] **Step 3: Implement**

Create `src/app/router.ts`:

```ts
import { __ } from '@wordpress/i18n';
import { useMemo, useSyncExternalStore } from 'react';

export type RouteName = 'redirects' | 'groups' | '404s' | 'logs' | 'site' | 'import-export' | 'settings' | 'support';

export interface Route {
	name: RouteName;
	query: Record< string, string >;
}

interface RouteDef {
	name: RouteName;
	/** Upstream page names covered by this route: used for capabilities and old `sub=` links. */
	pages: string[];
}

/** Sidebar order. */
export const ROUTES: RouteDef[] = [
	{ name: 'redirects', pages: [ 'redirect' ] },
	{ name: 'groups', pages: [ 'groups' ] },
	{ name: '404s', pages: [ '404s' ] },
	{ name: 'logs', pages: [ 'log' ] },
	{ name: 'site', pages: [ 'site' ] },
	{ name: 'import-export', pages: [ 'import', 'export' ] },
	{ name: 'settings', pages: [ 'options' ] },
	{ name: 'support', pages: [ 'support' ] },
];

export const DEFAULT_ROUTE: RouteName = 'redirects';

export function getRouteLabel( name: RouteName ): string {
	switch ( name ) {
		case 'redirects':
			return __( 'Redirects', 'dsuite-redirects' );
		case 'groups':
			return __( 'Groups', 'dsuite-redirects' );
		case '404s':
			return __( '404s', 'dsuite-redirects' );
		case 'logs':
			return __( 'Logs', 'dsuite-redirects' );
		case 'site':
			return __( 'Site & domain', 'dsuite-redirects' );
		case 'import-export':
			return __( 'Import / Export', 'dsuite-redirects' );
		case 'settings':
			return __( 'Settings', 'dsuite-redirects' );
		case 'support':
			return __( 'Support', 'dsuite-redirects' );
	}
}

function findRoute( name: string ): RouteDef | undefined {
	return ROUTES.find( ( route ) => route.name === name );
}

export function parseHash( hash: string ): Route {
	const body = hash.replace( /^#\/?/, '' );
	const split = body.indexOf( '?' );
	const path = split === -1 ? body : body.slice( 0, split );
	const route = findRoute( path );

	if ( ! route ) {
		return { name: DEFAULT_ROUTE, query: {} };
	}

	const search = split === -1 ? '' : body.slice( split + 1 );

	return { name: route.name, query: Object.fromEntries( new URLSearchParams( search ) ) };
}

export function buildHash( name: RouteName, query: Record< string, string > = {} ): string {
	const search = new URLSearchParams( query ).toString();

	return '#/' + name + ( search === '' ? '' : '?' + search );
}

export function pageForRoute( name: RouteName ): string {
	return findRoute( name )?.pages[ 0 ] ?? 'redirect';
}

export function routeForPage( page: string ): RouteName {
	return ROUTES.find( ( route ) => route.pages.includes( page ) )?.name ?? DEFAULT_ROUTE;
}

export function allowedRoutes( allowedPages: string[] ): RouteName[] {
	return ROUTES.filter( ( route ) => route.pages.some( ( page ) => allowedPages.includes( page ) ) ).map(
		( route ) => route.name
	);
}

export function resolveRoute( name: RouteName, allowed: RouteName[] ): RouteName | null {
	return allowed.includes( name ) ? name : allowed[ 0 ] ?? null;
}

/**
 * Old `?page=…&sub=404s&filterby[…]=…` links (PHP notices, plugin list links, bookmarks, the Tools redirect)
 * become `?page=…#/404s?filterby[…]=…`. Subs with no route (rss, downloads) are left for PHP.
 *
 * @param href Current location.
 */
export function legacyUrlToHashUrl( href: string ): string | null {
	const url = new URL( href );

	if ( url.hash !== '' ) {
		return null;
	}

	const params = new URLSearchParams( url.search );
	const page = params.get( 'page' ) ?? '';
	const sub = params.get( 'sub' );

	params.delete( 'page' );
	params.delete( 'sub' );

	let name: RouteName | null = null;

	if ( sub !== null ) {
		name = ROUTES.find( ( route ) => route.pages.includes( sub ) )?.name ?? null;
	} else if ( [ ...params.keys() ].length > 0 ) {
		name = DEFAULT_ROUTE;
	}

	if ( name === null ) {
		return null;
	}

	return url.pathname + '?page=' + encodeURIComponent( page ) + buildHash( name, Object.fromEntries( params ) );
}

function subscribe( onChange: () => void ): () => void {
	window.addEventListener( 'hashchange', onChange );

	return () => window.removeEventListener( 'hashchange', onChange );
}

export function useRoute(): Route {
	const hash = useSyncExternalStore( subscribe, () => window.location.hash );

	return useMemo( () => parseHash( hash ), [ hash ] );
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx jest src/app/router`
Expected: all tests pass.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm lint:ts && pnpm lint:js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/router.ts src/app/router.test.ts
git commit -m "feat: hash router with legacy sub URL rewrite"
```

---

### Task 3: Point table URL state at the hash

**Files:**
- Modify: `src/lib/wordpress-url/index.ts` (`getPageUrl`, ~line 7)
- Modify: `src/lib/hooks/use-table-url-sync.ts` (the "Sync table changes to URL" effect)
- Test: `src/lib/wordpress-url/index.test.js` (append), `src/lib/hooks/use-table-url-sync.test.ts` (create)

**Interfaces:**
- Consumes: `parseHash`, `buildHash`, `pageForRoute`, `routeForPage` from `app/router` (Task 2).
- Produces: `getPageUrl()` with no argument returns the hash query plus `sub: <upstream page name>`, e.g. `#/logs?orderby=ip` → `{ orderby: 'ip', sub: 'log' }`. With an argument it behaves as before (parses that search string). `useTableUrlSync` writes `history.replaceState( {}, '', '#/<route>?<params>' )`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/wordpress-url/index.test.js`. First extend the import on line 1 to include `getPageUrl`:

```js
import { getServerUrl, getOrigin, isRedirection, getPageUrl } from 'lib/wordpress-url';
```

and add at the end:

```js
describe( 'getPageUrl', () => {
	afterEach( () => {
		window.location.hash = '';
	} );

	it( 'reads the hash query and adds the upstream page name as sub', () => {
		window.location.hash = '#/logs?orderby=ip&filterby%5Bip%5D=1.2.3.4';

		expect( getPageUrl() ).toEqual( { orderby: 'ip', 'filterby[ip]': '1.2.3.4', sub: 'log' } );
	} );

	it( 'still parses an explicit search string', () => {
		expect( getPageUrl( '?page=x&sub=404s' ) ).toEqual( { page: 'x', sub: '404s' } );
	} );
} );
```

Create `src/lib/hooks/use-table-url-sync.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { useTableUrlSync } from 'lib/hooks/use-table-url-sync';
import type { TableState } from 'types';

window.Redirectioni10n = { per_page: '25' } as any;

const base: TableState = {
	page: 0,
	per_page: 25,
	orderby: '',
	direction: 'desc',
	selected: [],
	filterBy: {},
	groupBy: '',
};

describe( 'useTableUrlSync', () => {
	afterEach( () => {
		window.location.hash = '';
	} );

	it( 'writes table filters into the hash without touching the search string', () => {
		window.location.hash = '#/404s';
		const before = window.location.search;
		const setTable = jest.fn();

		const { rerender } = renderHook( ( table: TableState ) => useTableUrlSync( { table, setTable, pageName: '404s' } ), {
			initialProps: base,
		} );

		rerender( { ...base, filterBy: { ip: '1.2.3.4' }, page: 2 } );

		expect( window.location.hash ).toBe( '#/404s?offset=2&filterby%5Bip%5D=1.2.3.4' );
		expect( window.location.search ).toBe( before );
	} );

	it( 'reads filters from the hash on mount', () => {
		window.location.hash = '#/logs?filterby%5Bip%5D=9.9.9.9&orderby=ip';
		const setTable = jest.fn();

		renderHook( () =>
			useTableUrlSync( {
				table: base,
				setTable,
				pageName: 'log',
				allowedOrder: [ 'ip' ],
				allowedFilters: [ 'ip' ],
			} )
		);

		expect( setTable ).toHaveBeenCalledWith( { orderby: 'ip', filterBy: { ip: '9.9.9.9' } } );
	} );
} );
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/lib/wordpress-url src/lib/hooks`
Expected:
- the `getPageUrl` hash test fails, with the received value missing `sub: 'log'` (and the hash keys);
- the hook write test fails because the hash is unchanged and the search string gained `sub=404s…`;
- the hook read test fails because `setTable` was not called.

- [ ] **Step 3: Implement**

In `src/lib/wordpress-url/index.ts`, add the import at the top:

```ts
import { pageForRoute, parseHash } from 'app/router';
```

and replace `getPageUrl` with:

```ts
/**
 * With no argument, read the app's hash route query and add the upstream page name as `sub`,
 * so old pages that check `query.sub` keep working under hash routing.
 *
 * @param query Optional search string, e.g. `?page=x&sub=log`.
 */
export function getPageUrl( query?: string ): any {
	if ( query === undefined ) {
		const route = parseHash( document.location.hash );

		return { ...route.query, sub: pageForRoute( route.name ) };
	}

	const searchParams = new URLSearchParams( query.slice( 1 ) );
	const result: any = {};

	searchParams.forEach( ( value, key ) => {
		result[ key ] = value;
	} );

	return result;
}
```

In `src/lib/hooks/use-table-url-sync.ts`, add the import:

```ts
import { buildHash, parseHash, routeForPage } from 'app/router';
```

In the "Sync table changes to URL" effect:
- Replace `const searchParams = new URLSearchParams( document.location.search );` with:

  ```ts
  		const searchParams = new URLSearchParams( parseHash( document.location.hash ).query );
  ```

- Delete the whole `// Handle sub parameter` block (the `if ( pageName !== 'redirect' ) { searchParams.set( 'sub', pageName ); }` lines).
- Replace the last two lines (`const newUrl = '?' + searchParams.toString();` and `history.replaceState( {}, '', newUrl );`) with:

  ```ts
  		// Update the hash route without adding to history
  		history.replaceState( {}, '', buildHash( routeForPage( pageName ), Object.fromEntries( searchParams ) ) );
  ```

- [ ] **Step 4: Run them and confirm they pass**

Run: `npx jest src/lib/wordpress-url src/lib/hooks src/lib/table`
Expected: all pass. `src/lib/table` mocks `getPageUrl`, so it is unaffected.

- [ ] **Step 5: Run the JS suite and type-check**

Run: `pnpm test:js && pnpm lint:ts && pnpm lint:js`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wordpress-url src/lib/hooks
git commit -m "refactor: keep table URL state in the hash route"
```

---

### Task 4: App shell, mount point and boot rewrite

**Files:**
- Create: `src/app/shell/index.tsx`, `src/app/shell/style.scss`
- Test: `src/app/shell/shell.test.tsx`, `tests/integration/core/test-admin-menu.php` (append one test)
- Modify: `src/page/home/index.tsx`, `src/page/home/page-content.tsx`, `src/index.tsx`, `includes/plugin/class-admin.php` (`show_main()` ~line 785, the inline error script ~line 832)

**Interfaces:**
- Consumes: from Task 2, `RouteName`, `buildHash`, `getRouteLabel`, `allowedRoutes`, `resolveRoute`, `pageForRoute`, `useRoute` and `legacyUrlToHashUrl`; from Task 1, `Button`.
- Produces: `Shell( { routes, current, title, actions?, onNavigate?, children } )`, where:
  - `routes: RouteName[]`
  - `current: RouteName`
  - `title: string`
  - `actions?: ReactNode`
  - `onNavigate?: ( name: RouteName ) => void`

  It renders:

  ```
  .dsr-shell > nav.dsr-nav[aria-label] > ul.dsr-nav__list > li > a.dsr-nav__link[href="#/x"][aria-current]
             + .dsr-main.redirection > header.dsr-header > h1.dsr-header__title
  ```

  The `.redirection` class on `.dsr-main` keeps upstream page styles (`.redirection .wp-list-table`, `.redirection .form-table`) working.
- Produces (PHP): the admin page prints `<div class="wrap"><div id="dsr-app" class="dsr-app">…loading…</div></div>`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/shell/shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import Shell from 'app/shell';

describe( 'Shell', () => {
	it( 'renders one link per allowed route and marks the current one', () => {
		render(
			<Shell routes={ [ 'redirects', '404s', 'settings' ] } current="404s" title="404s">
				<p>content</p>
			</Shell>
		);

		const nav = screen.getByRole( 'navigation', { name: 'DSuite Redirects' } );
		const links = nav.querySelectorAll( 'a' );

		expect( links ).toHaveLength( 3 );
		expect( screen.getByRole( 'link', { name: '404s' } ) ).toHaveAttribute( 'aria-current', 'page' );
		expect( screen.getByRole( 'link', { name: 'Redirects' } ) ).not.toHaveAttribute( 'aria-current' );
		expect( screen.getByRole( 'link', { name: 'Settings' } ) ).toHaveAttribute( 'href', '#/settings' );
		expect( screen.queryByRole( 'link', { name: 'Logs' } ) ).toBeNull();
	} );

	it( 'renders the title, actions and content', () => {
		render(
			<Shell routes={ [ 'redirects' ] } current="redirects" title="Redirects" actions={ <button type="button">Add</button> }>
				<p>content</p>
			</Shell>
		);

		expect( screen.getByRole( 'heading', { level: 1, name: 'Redirects' } ) ).toBeInTheDocument();
		expect( screen.getByRole( 'button', { name: 'Add' } ) ).toBeInTheDocument();
		expect( screen.getByText( 'content' ).closest( '.dsr-main' ) ).toHaveClass( 'redirection' );
	} );

	it( 'tells the parent before navigating', () => {
		const onNavigate = jest.fn();
		render(
			<Shell routes={ [ 'redirects', 'logs' ] } current="redirects" title="Redirects" onNavigate={ onNavigate }>
				<p>content</p>
			</Shell>
		);

		screen.getByRole( 'link', { name: 'Logs' } ).click();

		expect( onNavigate ).toHaveBeenCalledWith( 'logs' );
	} );
} );
```

Append to `tests/integration/core/test-admin-menu.php`, before the final `}`:

```php
	public function testAdminScreenMountsAppInsideWrap() {
		wp_set_current_user( $this->factory->user->create( [ 'role' => 'administrator' ] ) );

		ob_start();
		( new Admin() )->admin_screen();
		$html = (string) ob_get_clean();

		$this->assertMatchesRegularExpression( '/<div class="wrap">\s*<div id="dsr-app" class="dsr-app">/', $html );
		$this->assertStringNotContainsString( 'id="react-ui"', $html );
	}
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/app/shell` and `pnpm wp-env run tests-cli --env-cwd=wp-content/plugins/dsuite-redirects ./vendor/bin/phpunit --configuration phpunit-integration.xml --filter testAdminScreenMountsAppInsideWrap`
Expected:
- Jest: FAIL, `Cannot find module 'app/shell'`.
- PHPUnit: FAIL, the regex does not match.

- [ ] **Step 3: Implement the Shell**

Create `src/app/shell/index.tsx`:

```tsx
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { buildHash, getRouteLabel, type RouteName } from 'app/router';
import 'ui';
import './style.scss';

interface ShellProps {
	routes: RouteName[];
	current: RouteName;
	title: string;
	actions?: ReactNode;
	onNavigate?: ( name: RouteName ) => void;
	children: ReactNode;
}

export default function Shell( { routes, current, title, actions, onNavigate, children }: ShellProps ) {
	return (
		<div className="dsr-shell notranslate" translate="no">
			<nav className="dsr-nav" aria-label={ __( 'DSuite Redirects', 'dsuite-redirects' ) }>
				<ul className="dsr-nav__list">
					{ routes.map( ( name ) => (
						<li key={ name } className="dsr-nav__item">
							<a
								className="dsr-nav__link"
								href={ buildHash( name ) }
								aria-current={ name === current ? 'page' : undefined }
								onClick={ () => onNavigate?.( name ) }
							>
								{ getRouteLabel( name ) }
							</a>
						</li>
					) ) }
				</ul>
			</nav>

			<div className="dsr-main redirection">
				<header className="dsr-header">
					<h1 className="dsr-header__title">{ title }</h1>
					{ actions && <div className="dsr-header__actions">{ actions }</div> }
				</header>

				{ children }
			</div>
		</div>
	);
}
```

Create `src/app/shell/style.scss`:

```scss
.dsr-app .dsr-shell {
	display: grid;
	grid-template-columns: 200px minmax(0, 1fr);
	gap: var(--dsr-space-6);
	align-items: start;
	margin-top: var(--dsr-space-4);
}

.dsr-app .dsr-nav__list {
	display: flex;
	flex-direction: column;
	gap: var(--dsr-space-1);
	margin: 0;
	padding: var(--dsr-space-3) var(--dsr-space-2);
	list-style: none;
	background: var(--dsr-surface);
	border: 1px solid var(--dsr-border);
	border-radius: var(--dsr-radius-lg);
}

.dsr-app .dsr-nav__item {
	margin: 0;
}

.dsr-app .dsr-nav__link {
	display: block;
	padding: var(--dsr-space-2) var(--dsr-space-3);
	border-radius: var(--dsr-radius-sm);
	color: var(--dsr-text-muted);
	text-decoration: none;
	white-space: nowrap;

	&:hover {
		background: var(--dsr-surface-muted);
		color: var(--dsr-text);
	}

	&:focus {
		box-shadow: none;
		outline: none;
	}

	&:focus-visible {
		box-shadow: var(--dsr-focus-ring);
	}

	&[aria-current="page"] {
		background: var(--dsr-accent-soft);
		color: var(--dsr-accent-text);
		font-weight: 500;
	}
}

.dsr-app .dsr-main {
	min-width: 0;
}

.dsr-app .dsr-header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--dsr-space-3);
	margin-bottom: var(--dsr-space-4);
}

.dsr-app .dsr-header__title {
	margin: 0;
	padding: 0;
	color: var(--dsr-text);
	font-size: 22px;
	font-weight: 600;
	line-height: 1.3;
}

.dsr-app .dsr-section-title {
	margin: var(--dsr-space-8) 0 var(--dsr-space-3);
	font-size: 16px;
	font-weight: 600;

	&:first-child {
		margin-top: 0;
	}
}

// Narrow container (WP's 782px breakpoint): the sidebar becomes a horizontally scrolling tab strip.
@container dsr (max-width: 781px) {
	.dsr-app .dsr-shell {
		grid-template-columns: minmax(0, 1fr);
		gap: var(--dsr-space-4);
	}

	.dsr-app .dsr-nav__list {
		flex-direction: row;
		overflow-x: auto;
		padding: var(--dsr-space-1);
	}
}
```

- [ ] **Step 4: Wire the shell into Home**

In `src/page/home/page-content.tsx`, replace the props interface and function with:

```tsx
import { __ } from '@wordpress/i18n';
import type { RouteName } from 'app/router';
import { has_page_access } from 'lib/capabilities';

interface PageContentProps {
	route: RouteName;
}

function PageContent( { route }: PageContentProps ) {
	switch ( route ) {
		case 'support':
			return <Support />;

		case '404s':
			return <Logs404 />;

		case 'logs':
			return <Logs />;

		case 'import-export':
			return (
				<>
					{ has_page_access( 'import' ) && (
						<>
							<h2 className="dsr-section-title">{ __( 'Import', 'dsuite-redirects' ) }</h2>
							<ImportPage />
						</>
					) }
					{ has_page_access( 'export' ) && (
						<>
							<h2 className="dsr-section-title">{ __( 'Export', 'dsuite-redirects' ) }</h2>
							<ExportPage />
						</>
					) }
				</>
			);

		case 'groups':
			return <Groups />;

		case 'settings':
			return <Options />;

		case 'site':
			return <Site />;

		case 'redirects':
			return <Redirects />;
	}
}
```

(Keep the existing page imports at the top of the file.)

Replace `src/page/home/index.tsx` with:

```tsx
import { useCallback, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import WelcomeWizard from 'component/welcome-wizard';
import DatabaseUpdate from './database-update';
import { Snackbar, ErrorBoundary, Error } from '@wp-plugin-components';
import DebugReport from './debug';
import ErrorDetails from './error-details';
import CrashHandler from './crash-handler';
import PageContent from './page-content';
import { getErrorLinks, getErrorDetails } from 'lib/error-links';
import CacheDetect from './cache-detect';
import UpdateNotice from './update-notice';
import { getInitialError, getInitialLog, getInitialGroup, getInitialRedirect } from 'lib/log-constants';
import { useMessageStore, useSettingsStore, useTableStore } from 'stores';
import { has_capability, CAP_REDIRECT_ADD } from 'lib/capabilities';
import { allowedRoutes, getRouteLabel, pageForRoute, resolveRoute, useRoute, type RouteName } from 'app/router';
import Shell from 'app/shell';
import { Button } from 'ui';
import './style.scss';

const ALLOWED_ROUTES = allowedRoutes( Redirectioni10n?.caps?.pages || [] );

export default function Home() {
	// Access store properties directly to avoid creating new objects on every render
	const errors = useMessageStore( ( state ) => state.errors );
	const notices = useMessageStore( ( state ) => state.notices );
	const { clearErrors, clearNotices } = useMessageStore();

	const databaseStatus = useSettingsStore( ( state ) => state.database.status );
	const showDatabase = useSettingsStore( ( state ) => state.showDatabase );
	const inProgress = useSettingsStore( ( state ) => state.database.inProgress );
	const pluginUpdate = useSettingsStore( ( state ) => state.values?.plugin_update ?? '' );
	const { setShowDatabase, setApi } = useSettingsStore();
	const { setErrorsTable, setLogsTable, setRedirectsTable, setRedirectsAddTop, setGroupsTable } = useTableStore();

	const route = useRoute();
	const current = resolveRoute( route.name, ALLOWED_ROUTES );

	// Initialize API routes, preloaded settings, and database status from global config on mount
	useEffect( () => {
		if ( window.Redirectioni10n?.api?.routes ) {
			setApi( {
				routes: window.Redirectioni10n.api.routes,
				current: window.Redirectioni10n.api.current ?? '',
			} );
		}

		// Initialize settings from preloaded data if available
		if ( window.Redirectioni10n?.settings && ! useSettingsStore.getState().values ) {
			const { setValues, setLoadStatus } = useSettingsStore.getState();
			setValues( window.Redirectioni10n.settings as any );
			setLoadStatus( 'success' );
		}

		// Initialize database status from preloaded data
		if ( window.Redirectioni10n?.database ) {
			const { setDatabase } = useSettingsStore.getState();
			setDatabase( window.Redirectioni10n.database as any );
		}
	}, [ setApi ] );

	// Same as upstream's menu click: a sidebar click starts the target page from a clean table.
	const onNavigate = useCallback(
		( name: RouteName ) => {
			clearErrors();

			if ( name === '404s' ) {
				setErrorsTable( getInitialError() as any );
			} else if ( name === 'logs' ) {
				setLogsTable( getInitialLog() as any );
			} else if ( name === 'redirects' ) {
				setRedirectsTable( getInitialRedirect() as any );
			} else if ( name === 'groups' ) {
				setGroupsTable( getInitialGroup() as any );
			}
		},
		[ clearErrors, setErrorsTable, setLogsTable, setRedirectsTable, setGroupsTable ]
	);

	if ( REDIRECTION_VERSION !== Redirectioni10n.version ) {
		return <CacheDetect />;
	}

	const page = current === null ? '' : pageForRoute( current );

	if ( databaseStatus === 'need-install' || databaseStatus === 'finish-install' ) {
		return (
			<ErrorBoundary renderCrash={ CrashHandler } extra={ { page } }>
				<WelcomeWizard />
			</ErrorBoundary>
		);
	}

	const needsUpgrader =
		pluginUpdate === 'prompt' && ( databaseStatus === 'need-update' || databaseStatus === 'finish-update' );

	return (
		<ErrorBoundary renderCrash={ CrashHandler } extra={ { page } }>
			{ needsUpgrader && (
				<div className="redirection">
					<DatabaseUpdate onShowUpgrade={ () => setShowDatabase( true ) } showDatabase={ showDatabase } />
				</div>
			) }

			{ current !== null && ! inProgress && databaseStatus !== 'finish-update' && ! showDatabase && (
				<Shell
					routes={ ALLOWED_ROUTES }
					current={ current }
					title={ getRouteLabel( current ) }
					onNavigate={ onNavigate }
					actions={
						current === 'redirects' && has_capability( CAP_REDIRECT_ADD ) ? (
							<Button variant="primary" onClick={ () => setRedirectsAddTop( true ) }>
								{ __( 'Add redirect', 'dsuite-redirects' ) }
							</Button>
						) : null
					}
				>
					<UpdateNotice />

					<Error
						errors={ errors }
						onClear={ () => clearErrors() }
						renderDebug={ DebugReport }
						details={ getErrorDetails() }
						links={ getErrorLinks() }
						locale="redirection"
					>
						<ErrorDetails />
					</Error>

					<PageContent route={ current } />

					<Snackbar
						notices={ notices }
						onClear={ () => clearNotices() }
						snackBarViewText={ __( 'View notice', 'dsuite-redirects' ) }
					/>
				</Shell>
			) }
		</ErrorBoundary>
	);
}
```

This drops the `getTitles`/`getMenu` helpers, `PageRouter`, `Menu` and the `useState`/`useMemo` page state. The `<h1 class="wp-heading-inline">` becomes the Shell title. Upstream titled the redirects page "Redirections"; it is now "Redirects".

- [ ] **Step 5: Mount point and boot rewrite**

In `src/index.tsx`, replace the bottom `if` block with:

```tsx
import { legacyUrlToHashUrl } from 'app/router';

// Old `?sub=` links become hash routes before the app reads the URL.
const hashUrl = legacyUrlToHashUrl( window.location.href );
if ( hashUrl ) {
	window.history.replaceState( null, '', hashUrl );
}

if ( document.querySelector( '#dsr-app' ) && window.Redirectioni10n ) {
	show( 'dsr-app' );
	window.redirection = window.Redirectioni10n.version;
}
```

Move the import up so it sits with the other imports.

In `includes/plugin/class-admin.php`, `show_main()`, replace:

```php
	<div id="react-modal"></div>
	<div id="react-ui">
```

with:

```php
	<div id="react-modal"></div>
	<div class="wrap">
	<div id="dsr-app" class="dsr-app">
```

Then directly after the matching closing `</div>` of that block (the one that follows `<?php $this->show_load_fail(); ?>`), add a second `</div>` to close `.wrap`.

In the inline script further down, change `document.querySelector( '#react-ui' )` to `document.querySelector( '#dsr-app' )`.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx jest src/app` and `pnpm wp-env run tests-cli --env-cwd=wp-content/plugins/dsuite-redirects ./vendor/bin/phpunit --configuration phpunit-integration.xml --filter AdminMenuTest`
Expected: Jest passes (3 shell tests plus the router tests); PHPUnit `OK (8 tests, …)`.

- [ ] **Step 7: Leftover check**

Run: `grep -rn "react-ui\|PageRouter\|getPluginPage" src includes --include='*.php' --include='*.ts' --include='*.tsx' | grep -v "src/wp-plugin-"`
Expected: only the unused `getPluginPage` export in `src/lib/wordpress-url/index.ts` and its test. Leave those for the Phase 8 cleanup.

- [ ] **Step 8: Run all suites and lint**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js && pnpm lint:ts && pnpm lint:js && npx wp-scripts lint-style 'src/ui/**/*.scss' 'src/app/**/*.scss'`
Expected: all pass. If a Jest test asserted the old "Redirections" title or the `Menu` markup, update only that string or selector, then re-run.

- [ ] **Step 9: Commit**

```bash
git add src/app src/page/home src/index.tsx includes/plugin/class-admin.php tests/integration/core/test-admin-menu.php
git commit -m "feat: DSuite app shell with sidebar and hash routes"
```

---

### Task 5: Width matrix and live checks

**Files:** none (verification only). If a step fails, fix it in the task that owns the code, re-run that task's tests, then come back.

- [ ] **Step 1: Build and load the dev site**

Run: `pnpm build`
Expected: exit 0. In wp-env, `dsuite-redirects` is active on http://localhost:8888 (activate it with `pnpm wp-env run cli wp plugin activate dsuite-redirects` if needed). Log in as admin / password with Chrome DevTools.

- [ ] **Step 2: Baseline the WP menu on the Dashboard**

At viewport 1440×900, open `http://localhost:8888/wp-admin/` and run this script in the page:

```js
() => {
	const pick = ( el ) => {
		const s = getComputedStyle( el );
		return [ s.width, s.backgroundColor, s.fontSize, s.fontFamily, s.position, s.zIndex ].join( '|' );
	};
	return {
		menu: pick( document.querySelector( '#adminmenu' ) ),
		wrap: pick( document.querySelector( '#adminmenuwrap' ) ),
		item: pick( document.querySelector( '#adminmenu > li > a' ) ),
	};
}
```

Record the result.

- [ ] **Step 3: Run the matrix on the plugin page**

Open `http://localhost:8888/wp-admin/admin.php?page=dsuite-redirects.php` and, for each of the three states below, run the same script plus:

```js
() => ( {
	hScroll: document.documentElement.scrollWidth > window.innerWidth,
	navDirection: getComputedStyle( document.querySelector( '.dsr-nav__list' ) ).flexDirection,
} )
```

| State | How | Expected |
|---|---|---|
| 1440 wide, menu expanded | resize 1440×900 | menu values equal the Step 2 baseline; `hScroll: false`; `navDirection: column` |
| 1100 wide, menu folded | resize 1100×900, click "Collapse Menu" | `#adminmenu` width equals the Dashboard's at 1100 folded (check the Dashboard at the same width and fold state); `hScroll: false`; `navDirection: column` |
| 375 wide | resize 375×800 | `#adminmenu` values equal the Dashboard's at 375; `hScroll: false`; `navDirection: row` |

Take a screenshot of each state and keep them for the final summary. Re-expand the WP menu afterwards.

- [ ] **Step 4: Check another admin screen is untouched**

Open `http://localhost:8888/wp-admin/edit.php` at 1440. Run `() => getComputedStyle( document.querySelector( '.wrap h1' ) ).fontSize`
Expected: `23px` (stock), proving the `.dsr-` styles don't leak.

- [ ] **Step 5: Routing checks**

On the plugin page, check each of these:
1. `admin.php?page=dsuite-redirects.php&sub=options` lands on `#/settings`, and the Settings item is current.
2. `tools.php?page=redirection.php&sub=404s` lands on `#/404s`.
3. On `#/404s`, apply any filter or move to page 2 (if there is data; otherwise do it on `#/logs`). The hash gains the filter. Reload: the filtered view returns. Press Back: you leave the plugin page or return to the previous route, not to an unfiltered copy of the same route.
4. Tab through the sidebar with the keyboard: every link shows a visible focus ring, and Enter navigates.
5. The console has no errors (`list_console_messages`, types error/warn).

- [ ] **Step 6: Final run**

Run: `pnpm test:unit:env && pnpm test:integration && pnpm test:js && pnpm lint:ts && pnpm lint:js`
Expected: all green. Commit only if something was fixed during these checks (`fix: <what>`).

---

## Next

Once Phase 2 is merged, write `docs/superpowers/plans/<date>-phase3-redirects-page-drawer.md` against the code as it stands then (spec §4.5 Redirects + drawer, §9 step 3). That plan also builds `Drawer`, `Combobox`, `Segmented`, `Badge` and `Table`, and decides where group management lives.
