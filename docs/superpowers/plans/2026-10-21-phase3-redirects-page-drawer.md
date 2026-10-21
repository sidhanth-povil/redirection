# Phase 3: Redirects Page and Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace upstream's Redirects table and inline editor with the marketer-first list and the create/edit drawer from the spec. The list gets search, status chips, a group filter, type badges and bulk actions. The drawer offers an Old URL field, page search for the destination, plain-language types, and an Advanced section that keeps every upstream power option.

**Architecture:**
- New `src/ui` components: `Field`, `Badge`, `Segmented` (native radios), `Drawer` (portal + `react-focus-lock`) and `Combobox` (Headless UI).
- The drawer's data rules live in a pure module, `src/page/redirects/model.ts`. It holds the same state shape as upstream's editor, so upstream's match/action field components plug straight into the Advanced section.
- The list page reuses the existing React Query hooks, the table store and `useTableUrlSync`.
- Destination search uses core REST `/wp/v2/search`, which covers posts, pages and public CPTs.
- The old list files are deleted. `component/redirect-edit` stays, because the Logs/404s "add redirect" flow and the Advanced section use it.

**Tech Stack:** React 18 + TypeScript, `@headlessui/react` 2.2, `react-focus-lock`, `use-debounce`, React Query, zustand, SCSS (container queries), Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-21-dsuite-redirects-design.md` (§4.2, §4.3, §4.5 Redirects + drawer, §9 step 3)

## Global Constraints

- Every selector is prefixed `.dsr-` and nested under `.dsr-app`. No styles target wp-admin chrome or bare elements outside `.dsr-app` (spec §4.2).
- **Component styles live in files named `style.scss`.** wp-scripts only bundles CSS from `style.scss` files into `build/redirection.css` (Phase 2 ruling).
- Responsive layout uses container queries (`@container dsr (max-width: 781px)`); URLs truncate with ellipsis and carry a `title` attribute (§4.2.4).
- The drawer is portalled with a z-index **below** WP's admin bar (99999) and **above** the admin menu (9990), with focus trapped by `react-focus-lock` (§4.2.5).
- No new runtime dependencies. Reuse `@headlessui/react`, `react-focus-lock` and `use-debounce` (§4.3).
- Plain-language types: Permanent (301), Temporary (302), Gone (410). Every other action and code lives under Advanced (§4.5).
- The Advanced section's open/closed state is stored in `localStorage` under `dsr_advanced_open`, read and written inside try/catch (§4.5).
- Unsaved changes trigger a confirm on close (§4.5). A server error is shown in the drawer and keeps the typed values (§6).
- Test files import `@testing-library/jest-dom` explicitly. `tsconfig` has no `dom.iterable`, so don't spread or `Object.fromEntries` a `URLSearchParams` (Phase 2 rulings).
- PHP tests run in `tests-cli`.

## Decisions this plan makes

1. **Out of scope, deferred to later phases:**
   - Scheduled/Expired chips and the schedule fields arrive with Phase 4 (scheduling).
   - The wildcard hint arrives with Phase 5, so the drawer doesn't advertise `*` before it works.
   - The pre-save chain check arrives with Phase 6.
2. **Search is one box plus a "Search in" select** (Old URL / Destination / Title). The REST list filters one field at a time, so "search across source, target and title" means picking the field.
3. **No "Move to group" bulk action.** The bulk REST route only supports delete/enable/disable/reset. A group can be changed per redirect in the drawer.
4. **Picking a search result fills in the page's path** (for example `/hello-world/`), not the absolute permalink. It's the same page on this site, and the link survives a domain or staging→live move.
5. **"Live" chip** maps to upstream's `status=enabled` filter, and "Disabled" maps to `status=disabled`.
6. **Groups keep their own sidebar page** for now (Phase 2 Decision 3). Here they appear only as a filter and a field.
7. **Code lives in the plan's companion files.** The full component code for Tasks 1–5 is long, so each task names its files, interfaces and tests, and the executor writes the code to those contracts. The tests in each task are the binding contract.

## Review Focus

1. **Editing an advanced redirect and saving without touching Advanced must keep it exactly as it was.** This covers regex, login/referrer conditions, 307, and pass-through: none may be silently turned into a 301 URL redirect. Pinned in Task 3 (`round-trips a conditional redirect unchanged`), Task 4 (`edit of a 307 shows no plain type and keeps it`), and Task 6, Step 4.
2. **The drawer over WP chrome:** it sits above the admin menu and below the admin bar, Esc closes it, focus stays inside, and focus returns to the button that opened it. Pinned in Task 1 (Drawer tests) and Task 6, Step 3.
3. **Unsaved changes and server errors never lose typed input.** Pinned in Task 4 (`asks before discarding changes`, `keeps values and shows the error when saving fails`).
4. **Narrow widths (375px, emulated):** the list stacks into cards, the drawer goes full width, and there is no horizontal scroll. Checked in Task 6, Step 5.
5. **Users without add or delete capability** don't see Edit/Enable/Disable or Delete. Pinned in Task 5 (`hides actions the user cannot perform`).

---

## Tasks

| # | Task | Files | Tests (binding) |
|---|---|---|---|
| 1 | `Field`, `Badge`, `Segmented`, `Drawer` | `src/ui/{field,badge,segmented,drawer}/{index.tsx,style.scss}`, `src/ui/index.ts` | `src/ui/ui.test.tsx`: Field labels its control and hint; Badge tone class; Segmented is a labelled radio group, reports the value; Drawer renders nothing closed, is a labelled `aria-modal` dialog inside `.dsr-app`, closes on Escape and the Close button |
| 2 | `Combobox` + `searchContent` | `src/ui/combobox/*`, `src/page/redirects/search-content.ts` | `src/ui/combobox.test.tsx`: free text is the value; searches after a 250ms pause and fills in the picked option; no search under 2 chars. `search-content.test.ts`: calls `getApiRequest('wp/v2/search', {search, type:'post', per_page:8})`, maps to `{ value: path, label: title‖path, detail: 'subtype · path' }` |
| 3 | Drawer model + row descriptions | `src/page/redirects/{model,describe}.ts` | `model.test.ts`: new state from defaults; reads an existing redirect; plain-type mapping (307/pass/conditional → null); Gone is a 410 and keeps the target; `canSave` rules; `toPayload` shape; **round-trips a conditional redirect unchanged**. `describe.test.ts`: destination text for url/410/404/pass/random/nothing/login; badges Permanent/Temporary/Gone/code |
| 4 | Redirect drawer | `src/page/redirects/redirect-drawer.tsx`, `style.scss` | `redirect-drawer.test.tsx`: creates a temporary redirect from simple fields; save disabled until a destination; **edit of a 307 shows no plain type and keeps it**; **asks before discarding changes**; **keeps values and shows the error when saving fails**; remembers Advanced state in `dsr_advanced_open` |
| 5 | Redirects list page | rewrite `src/page/redirects/index.tsx`, new `redirect-table.tsx`, delete `create.tsx`, `row-actions.tsx`, `columns/`, `constants.ts` | `index.test.tsx`: lists source, `→ destination`, plain type and Disabled badges; status chips filter (`aria-pressed`); Edit opens the drawer prefilled; bulk delete after confirm calls `remove.mutate({items:[1]})`; deep link `#/redirects?new=1&from=…` opens a prefilled drawer and clears the hash; **hides actions the user cannot perform** |
| 6 | Live checks | none | Build; marketer flow (search "hello" → `/hello-world/`, Temporary → `curl` 302 + `X-Redirect-By: dsuite-redirects`); drawer z-index/Esc/focus/discard prompt; Advanced 307 round-trip; 375px emulated (cards, full-width drawer, no h-scroll); bulk disable/enable/delete; deep link; full suites |

Every task follows RED → GREEN: write the named tests, watch them fail for the stated reason, implement, watch them pass, lint (`pnpm lint:ts`, `wp-scripts lint-js`, `lint-style` on touched SCSS), and commit with a `feat:` message.

## Next

Phase 4 (scheduling): the `dsr_db_version` upgrader with `start_at`/`end_at`, the query clause, the cache guard, Scheduled/Expired chips and badges, and the drawer's schedule toggle (spec §5.1, §9 step 3).
