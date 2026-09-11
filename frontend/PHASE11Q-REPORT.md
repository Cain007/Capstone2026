# PHASE 11Q - FINAL REGRESSION + BUNDLE/SECURITY REPORT

Date: 2026-09-09

## Scope and Files

Created:
- `src/components/system/PageLoadBoundary.tsx`
- `PHASE11Q-REPORT.md`

Modified:
- `src/pages/dashboard-pages/index.ts`
- `src/pages/dashboard.tsx`
- `package-lock.json`

Removed:
- `src/services/api.ts`: zero-byte file, no source references.
- Temporary browser QA scripts after verification.

Existing changes from earlier phases were preserved. No application CSS, package.json declarations, Vite configuration, backend, API contract, schema, auth storage keys, or business calculations changed in this phase.

## Initial Bundle Audit

The pre-edit production build emitted `index-Cuj9o4NI.js`: 626.71 kB minified / 179.78 kB gzip, with the >500 kB warning. Its stylesheet was `index-eNUivkqL.css`: 203.74 kB.

The import graph showed that dashboard.tsx eagerly imported the page barrel, which re-exported all 15 pages. This pulled business pages, six D3 charts, and Help content into the entry graph. AppShell also eagerly imports Notification Center and shared Base UI primitives. Lucide imports are named imports, not a package-wide icon map.

The split build provides concrete contributor sizes below; these are emitted chunk sizes, not speculative per-library source-size estimates. The main chunk retains React, AppShell, authentication, notifications, and shared infrastructure. No separate React/Base UI attribution was measured.

## Lazy Loading

- All 15 business page exports now use explicit, typed `React.lazy` imports.
- Lazy pages: Dashboard, Products, Categories, Suppliers, Inventory, Stock Movements, Sales History, Predictive Analysis, Reports, Purchase Orders, User Management, Audit Logs, Account & System, Help, POS.
- Eager: AppShell, authentication and forced-password shells, viewport gate, tokens, critical shared UI and loading surface.
- Manual page keys, role filtering, onNavigate, Help topic handoff, and PO prefill callbacks remain unchanged.
- Suspense displays the existing Spinner inside AppShell; navigation remains available during loading.
- A small keyed boundary shows a visible page failure with reload and navigation recovery. It also catches page render errors; no sensitive diagnostic details are shown.
- No preload-all, explicit prefetch, router, service worker, caching layer, or manualChunks configuration added.
- Vite naturally extracts shared chart/D3 code. No D3 imports or calculations rewritten.
- Help content is loaded with Help; eager imports of Help topic types are erased by TypeScript.

## Reproducible Build

The initial node_modules did not match package-lock.json, including React, Vite and lint tooling. The first split build on that installation was 329.37 kB. Final figures below are from a clean `npm ci --ignore-scripts` installation of the updated lockfile, followed by all checks and production-browser regression again. Declared dependency ranges were not changed. Final locked Vite is 8.0.16; the original installed Vite was 8.2.2.

| Final emitted JavaScript | Minified kB | Gzip kB |
| --- | ---: | ---: |
| index-Cef79oEI.js (main) | 330.88 | 106.65 |
| charts-hdJZZc40.js (largest shared lazy chunk) | 56.85 | 19.86 |
| forecasting-DvqFqCvD.js (largest page chunk) | 27.68 | 7.48 |
| help-CT_WjIys.js | 23.44 | 8.21 |
| reports-B3VM2L1c.js | 23.25 | 6.41 |
| purchase-orders-B6yDMKXp.js | 23.09 | 6.23 |
| dashboard-D-6nmWVU.js | 20.50 | 5.66 |
| pos-BjwL3gHB.js | 12.91 | 4.43 |

Main reduction against requested baseline: **295.83 kB / 47.2%**. This comparison includes reconciling the pre-existing install/lock discrepancy, not solely the code change.

Vite >500 kB warning: **NO**, for both initial and lazy chunks.

## Network Evidence

Observed through Playwright requests against Vite production preview, not the dev module server:

- Login: only `index-Cef79oEI.js`; no business-page JavaScript requested.
- Admin initial Dashboard: main, Dashboard, charts, peso icon, shared UI, MetricCard. No Help, Reports, Forecasting, POS or other Admin pages prefetched.
- Staff initial POS: main, POS, trash/search icons, shared UI, MetricCard, layout and PageSection. No Dashboard, chart/D3, Help, Reports, Forecasting, PO, Audit or User Management page chunks.
- Help, Reports and Forecasting chunks appeared upon navigation to those pages.
- Shared chart code may already be cached when Admin moves from Dashboard to Reports; it is not redundantly downloaded.
- Forced password-change shell loads without business-page chunks.

## Dependency Security

Initial audit: **4 high, 1 moderate, 0 low, 0 critical**. All five were transitive tooling dependencies, not shipped browser runtime modules.

| Package | Severity | Chain / exposure | Fixed lock version |
| --- | --- | --- | --- |
| brace-expansion | High | ESLint -> minimatch; tooling expansion DoS | 5.0.9 |
| browserslist | High | eslint-plugin-react-hooks -> Babel compilation targets; tooling memory/prototype issues | 4.28.9 |
| nanoid | High | Vite -> PostCSS; tooling generator input DoS | 3.3.18 |
| postcss | High | Vite; tooling source-map path/file disclosure | 8.5.28 |
| baseline-browser-mapping | Moderate | Browserslist; tooling invalid-input process termination | 2.11.21 |

Each finding had a compatible fix available. Classification: safely fixable within parent ranges (A) and tooling exposure (C); no required breaking-major upgrade (B) or demonstrated browser-runtime exposure (D).

Used targeted `npm update baseline-browser-mapping brace-expansion browserslist nanoid postcss --package-lock-only --ignore-scripts`, then a clean lockfile install. No broad speculative direct-package upgrades.

`npm audit fix`: NOT USED. `npm audit fix --force`: NOT USED.

Final npm audit: **0 vulnerabilities at every severity**. This is a dependency advisory result, not proof that the application has no security vulnerabilities.

## Client Review and Cleanup

- Hardcoded secrets/private keys/database URLs/JWT secrets/demo passwords: none found in reviewed frontend source.
- Environment keys: only VITE_API_URL; local example is the public API origin. No secret added to VITE variables.
- Token logging / temporary production console logging: none found.
- dangerouslySetInnerHTML / innerHTML injection: none found; Help renders React text.
- target=_blank: none found requiring rel remediation.
- Production source maps: not enabled; configuration unchanged.
- One public cn entry point, `src/lib/utils.ts`, re-exporting the existing cn dependency. No new class utility.
- Legacy auth stylesheet imports absent. No mass CSS deletion; existing ui-card and generated primitives retained.
- Unused imports removed: none beyond replacing eager page exports with lazy declarations.
- Auth token and Remember Me keys unchanged; no storage redesign.

## Regression

All PASS entries below describe mocked frontend browser checks, not live database validation.

| Area | Result / tested behavior |
| --- | --- |
| Auth | PASS: login, both Remember Me choices, storage selection, logout token clearing |
| Forced password | PASS: eager shell, submit, transition to Dashboard |
| Admin navigation | PASS: all 14 visible Admin pages |
| Staff navigation | PASS: all 6 Staff pages, Admin bell absent, initial Admin chunks absent |
| Dashboard | PASS: load and Sales Trend first-mount SVG |
| Products | PASS: create, edit, delete with mocked writes |
| Categories | PASS: create, edit, delete with mocked writes |
| Suppliers | PASS: create, edit, delete with mocked writes |
| Inventory | PASS: load and adjustment submission |
| Stock Movements | PASS: lazy page, empty-list rendering and responsive navigation |
| POS | PASS: search, add, quantity increase/decrease, remove, cash/change, disabled pending submit, one sale request |
| Sales History | PASS: lazy page, empty-list rendering and responsive navigation |
| Predictive Analysis | PASS: forecast, evaluation, charts, Help topic handoff |
| Reports | PASS: all three charts on first lazy mount |
| Purchase Orders | PASS: create Draft, mark Ordered, partial receiving, full receiving |
| User Management | PASS: create, edit, suspend, password reset, required-password badge |
| Audit | PASS: Activity, Login History, search/apply, pagination, both detail dialogs |
| Account | PASS: details/system information rendering, password change submission |
| Help | PASS: search, topic handoff, expanded Moving Average answer, Staff view |
| Notifications | PASS: open, refresh, navigate to Inventory, hidden for Staff |
| Phone gate | PASS: 767, 430, 375; compatibility screen only, no visible AppShell |
| D3 | PASS: all six charts rendered with nonzero dimensions; Forecast resize checked |
| Chunk failure | PASS: aborted Reports import gives visible error and navigation recovery |
| Delayed/rapid navigation | PASS: held Forecast import shows fallback; navigating away and back succeeds |

Responsive navigation/layout checks for all role-appropriate pages:
**768, 820, 834, 1024, 1280, 1366, 1920: PASS**. No page-level horizontal overflow in these checks. Heights used: 768 and 800. Forecast screenshots captured and reviewed at 1366 and 820.

## Final Checks and Limits

- Frontend lint: PASS.
- Explicit `npx tsc -p tsconfig.app.json --noEmit --incremental false`: PASS.
- Frontend production build: PASS.
- npm audit: PASS, zero findings.
- Backend / API / schema changes: NONE.
- Business logic changes: NO.
- New dependencies: NONE. Existing Playwright tooling was temporarily preserved outside the application for QA across npm ci.
- No branding/image integration, Motion, router or bundle analyzer added.
- Remaining security findings: none reported by npm audit; no penetration test performed.
- Remaining performance limitations: main still includes eager shell/React/notifications; no runtime performance timings or physical-device profiling performed.
- QA used Chromium and mocked API data; no live writes, database invariants, physical iPad Safari, exhaustive malformed-data cases, or populated Sales History/Stock Movement detail regression in this phase.
- Clean install used --ignore-scripts; lint/build and browser checks verified the resulting installation.
- Deploy HTML and hashed assets atomically, or retain old assets during rollout. Failed stale-chunk imports now offer reload, but deployment caching policy was not changed.

Definition of Done: **PASS for the stated frontend technical stabilization and mocked smoke-test scope**, with the limits above. Brand/image integration was not started.
