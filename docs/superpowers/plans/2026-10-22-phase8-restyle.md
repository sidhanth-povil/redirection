# Phase 8: Restyle the Remaining Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. RED → GREEN per task; the named tests are the binding contract.

**Goal:** Every page in the sidebar looks like part of one app (soft indigo, cards, `.dsr-` tables), and the upstream table UI is gone from the codebase.

**Architecture:**
- **Logs** and **Groups** are rebuilt like the 404s page: `.dsr-toolbar` (search + chips), `.dsr-table`, `.dsr-bulkbar`, `.dsr-pagination`. They reuse the existing hooks (`useLogList`, `useLogBulkAction`, `useExport`, `useGroupList`, `useGroupBulkAction`, `useGroupCreate`, `useGroupUpdate`) and the table store.
- **Settings, Site & domain, Import/Export, Support** keep their markup and behaviour. One scoped stylesheet, `src/ui/legacy.scss`, restyles the upstream WP markup they render (`.form-table`, `.widefat`, `.button*`, inputs, selects, notices) inside `.dsr-app`, and each section sits in a `.dsr-card`.
- Deleted once nothing imports them: `component/table`, `component/log-page`, `component/display-options`, `component/search-box`, `component/progress`, the old Logs and Groups files (`columns`, `constants`, `row-actions`, `create-group`, `style.scss`).

**Spec:** §4.2 (scoping), §4.4 (old pages deleted when replaced), §4.5 "Logs, Site & domain, Import/Export, Settings", §9 step 8.

## Decisions
1. **Logs keeps its behaviour, minus the column picker.** Kept: URL search, group by URL / IP / agent (chips; IP only when IP logging is on), bulk delete (selected), bulk export CSV, row delete, View redirect, Show all (from a grouped row), RSS link. Links that arrive with other filters (`referrer`, `ip`, `method`, …) still work through `useTableUrlSync`; the toolbar shows a "Filtered" chip that clears them. Dropped: the display-column picker and the user-agent / request-data popups. The agent is shown truncated with the full value in `title`.
2. **Groups drops bulk actions and group export.** Groups are few, so row actions cover it: Edit (inline name + module), Enable/Disable, View redirects (`#/redirects?filterby[group]=<id>`), Delete. Group export stays on the Import/Export page.
3. **Form pages are restyled, not rewritten.** Their behaviour is already right, and a rewrite of ~3k lines would change behaviour that the spec says must not change. `legacy.scss` selectors are all `.dsr-app …`, never bare, per §4.2.

## Tasks
| # | Task | Files | Tests (binding) |
|---|---|---|---|
| 1 | Logs page | `src/page/logs/index.tsx` (rewrite) | `src/page/logs/index.test.tsx`: rows show date, URL → target, agent; search sets `filterBy.url`; group chips set `groupBy` (IP chip hidden without IP logging); Delete asks then deletes; bulk Delete and Export CSV on the selection; View redirect link for rows with `redirection_id`; Show all on a grouped row filters by it; Filtered chip clears foreign filters |
| 2 | Groups page | `src/page/groups/index.tsx` (rewrite) | `src/page/groups/index.test.tsx`: rows show name, module, redirect count, Disabled badge; Add creates with name + module; Edit saves name + module; Enable/Disable/Delete call the bulk action; View redirects links to the group filter; no Add without `CAP_GROUP_ADD` |
| 3 | Delete old table UI | `component/{table,log-page,display-options,search-box,progress}`, old Logs/Groups files | `pnpm lint:ts` and `pnpm test:js` green with nothing importing them |
| 4 | Form pages restyle | `src/ui/legacy.scss`, card wrappers in `page/options`, `page/site`, `page/support`, `page/home/page-content.tsx` | Live screenshots at 1440 / 1100 (folded) / 375: cards, no underlined labels, no horizontal scroll, WP menu unchanged |
| 5 | Live checks | none | Logs and Groups against real data; full JS, unit and integration suites |
