# PHASE 11O-E - FINAL BRAND/IMAGE/THEME REGRESSION REPORT

Date: September 11, 2026

## Final Status

**CONDITIONAL PASS.** Local application regression and mocked image integration pass. Deployment image acceptance is incomplete: credential rotation has not been confirmed, so live Cloudinary verification and the complete image-backed sale/receiving workflow were NOT RUN.

No application source fixes, redesign, dependency changes, schema changes, API changes, or business calculation changes were made in this phase. Prior worktree changes were preserved. This report is the only retained new file.

## Evidence Classification

- **LIVE:** Chromium with the actual local frontend, Express API, and PostgreSQL, without API interception. Applies to authentication, read-only operational pages, disposable Product/User CRUD, and administrative interactions. It does not imply Cloudinary was tested.
- **MOCKED:** Production-preview image/POS tests intercept mutation requests and image responses. No sales or image requests from these tests reached a live provider or business transaction endpoint. Read requests not replaced by fixtures were forwarded to the real API through the test transport.
- **MOCKED provider / LIVE local DB:** Existing image integration suite runs the real HTTP routes, middleware, Prisma transactions, and PostgreSQL with the Cloudinary SDK boundary mocked.
- **NOT RUN:** No successful live provider operation or image-backed end-to-end transaction is claimed.

## Environment And Credentials

| Item | Result |
| --- | --- |
| Frontend | LIVE, http://localhost:5173 |
| Production preview | http://localhost:4174, current production build |
| Backend | LIVE, http://localhost:5000 |
| PostgreSQL | LIVE local development database, reachable |
| CLOUDINARY_CLOUD_NAME | CONFIGURED |
| CLOUDINARY_API_KEY | CONFIGURED |
| CLOUDINARY_API_SECRET | CONFIGURED |
| Cloudinary credential rotation | NOT CONFIRMED |
| backend/.env ignored by Git | YES, verified with git check-ignore |
| Backend restarted after env change | YES; previous workspace watcher stopped and restarted from backend/ |
| Restarted backend health | PASS, /api/health returned status ok |
| Credential values printed in report | NO |
| Secret matches in frontend source/build/env scan | 0 |

Presence checks do not establish credential validity or revocation of the exposed credential. No authenticated Cloudinary Console session or rotation confirmation was available. The fresh backend loads backend/.env via its existing dotenv startup path; provider authentication remains unverified.

## Live Cloudinary

**LIVE CLOUDINARY: NOT RUN.** Reason: credential rotation NOT CONFIRMED. Confirmation was requested without asking the user to disclose a secret. No provider calls were made by this verification pass.

| Required Operation | Live Result |
| --- | --- |
| UPLOAD | NOT RUN |
| LOAD over HTTPS | NOT RUN |
| RELOAD from PostgreSQL + Cloudinary | NOT RUN |
| REPLACE and old-asset cleanup | NOT RUN |
| REMOVE and reload persistence | NOT RUN |
| POS PROPAGATION | NOT RUN |
| Cloudinary Media Library product folder | NOT VERIFIED; expected king-of-clouds/products |
| Live Product deletion with image | NOT RUN |
| Provider-operation backend log review | NOT RUN |

All six required live operations must complete after confirmed rotation before changing this section to PASS. Configuration alone is not a live-image acceptance result.

## Official Logo, Public Entry, And Authentication

| Check | Result |
| --- | --- |
| Light logo | PASS: /Black Logo.png on Home, Login, expanded desktop AppShell |
| Dark logo | PASS: /White Logo.png on the same surfaces |
| Theme switch | PASS: immediate logo source and root-theme changes |
| Theme reload | PASS: persisted light/dark theme and correct decoded logo after reload |
| Logo geometry | PASS: decoded images, square rendered bounds; representative screenshots inspected |
| Collapsed sidebar | PASS: detailed logo hidden; intentional compact KOC presentation retained |
| Home | PASS in both themes; branding, capability surfaces, Sign In; no registration action |
| Home -> Login -> Home | PASS |
| Login alignment | PASS at 1024, 1280, 1366, 1920; top/bottom card-space difference below 6px at 900px height |
| Admin login | LIVE PASS with disposable account |
| Remember Me | LIVE PASS: localStorage token, no sessionStorage duplicate |
| Staff login | LIVE PASS with disposable account |
| Session mode | LIVE PASS: sessionStorage token, no localStorage duplicate |
| Forced password change | LIVE PASS: gate displayed, password changed, Staff entered POS |
| Authenticated reload | LIVE PASS for both storage modes |
| Logout | LIVE PASS: Home restored, both auth-token stores empty, dark theme retained |

Theme initialization code remains unchanged. Reload checks establish the resulting theme/logo; sub-frame paint-flash measurement was not performed.

## Product Images And Security

| Check | Result And Boundary |
| --- | --- |
| Products table | LIVE null-image fallback; MOCKED valid-image update and 40px decoded thumbnail |
| Product form | LIVE responsive form; MOCKED selected-image preview |
| Preview | MOCKED PASS, object-URL preview and existing 140px area |
| Missing fallback | PASS on LIVE catalog and POS |
| Broken fallback | MOCKED PASS; failed remote image removed, fallback displayed, Add remained usable |
| Replace | MOCKED browser PASS; API's imageUrl response updates table without page reload |
| Remove | MOCKED browser PASS; confirmation, null metadata, fallback, restored editor |
| Client invalid formats | MOCKED browser PASS: TXT, GIF, SVG, PDF rejected in both themes |
| Client size limit | MOCKED browser PASS: over 5 MiB rejected |
| Backend format/signature/size validation | PASS with LIVE HTTP/DB and MOCKED provider |
| Admin image mutations | PASS with LIVE middleware/DB and MOCKED provider |
| Staff image mutation 403 | PASS with LIVE middleware/DB and MOCKED provider |
| Unauthenticated mutation 401 | PASS with LIVE middleware and MOCKED provider |
| Staff UI | LIVE POS display; mutation controls absent from Staff POS; Products read-only coverage also documented in Phase 11O-D |
| Upload/replace/remove audit events | PASS in local integration transactions with MOCKED provider; not live Cloudinary audit evidence |
| Delete Product with image | PASS in local integration suite with MOCKED provider, including best-effort cleanup failure |
| Referenced Product with image | PASS: local integration suite returns 409 without deleting mocked remote asset |
| Image storage shape | Source verified: remote URL metadata, no frontend imagePublicId or base64 persistence |

The image integration suite passed **20 tests, 0 failures** (19 scenarios plus the parent test). Coverage includes valid JPEG/PNG/WebP, duplicate/unexpected multipart fields, missing Product, authorization, rate limiting, upload failure, replacement ordering, audit/database rollback, compensation cleanup, concurrent metadata conflict, idempotent removal, missing remote asset, transient database reconciliation, and Product deletion behavior.

Two deliberate database/audit failure injections emitted sanitized operation-level error messages as expected. No actual provider secret was logged. Those injected failures are not application regressions.

## POS

| Check | Result |
| --- | --- |
| Images | MOCKED decode/display coverage; LIVE catalog currently exercises missing-image fallback |
| Fallback | PASS, null LIVE and broken MOCKED |
| Out of Stock | LIVE rendering and disabled Add state retained |
| Search/category/sort | MOCKED PASS |
| Add/increase/decrease/remove | MOCKED PASS |
| Stock limit | MOCKED PASS: quantity limited to two, further increase disabled |
| Cash/change | MOCKED PASS: two PHP 25 items, PHP 100 cash, PHP 50 total/change |
| Completion | MOCKED PASS: one sale request, completed-sale UI |
| Duplicate-submit protection | MOCKED PASS: pending submit disabled, one request recorded |
| Image dimensions/lazy loading | Fixed 40px table and 140px preview/catalog CSS; browser decode and size checks on mocked remote image |
| Live sale | NOT RUN |

No inventory decrements or real sale records were created by the browser POS checks.

## Theme And Charts

Both themes passed page-rendering and document-overflow checks for Dashboard, Products, Categories, Suppliers, Inventory, Stock Movements, Sales History, Predictive Analysis, Reports, Purchase Orders, User Management, Audit Logs, Account & System, and Help. Product forms, POS, and Notification Center were also exercised.

All six charts were checked using real local data in both themes:

- Dashboard Sales Trend.
- Forecast Chart and Forecast Evaluation for an existing seeded Product/run.
- Reports Sales Trend, Top Products, and Inventory Health.

SVGs had nonzero dimensions, rendered marks, no NaN/Infinity geometry, and working keyboard-focus tooltips. Existing zero-demand forecast/evaluation states rendered correctly. Forecast dropdown top edges remained aligned. No chart data, scales, geometry implementation, or business calculations were edited.

Representative screenshots were visually inspected for light Dashboard, dark Reports, populated light Forecasting, dark desktop Login, dark tablet Product form, and light tablet POS. This is Chromium verification, not a complete WCAG certification or physical iPad Safari test.

## Responsive

Tests used a 900px viewport height; desktop/tablet widths refer to browser CSS pixels.

| Width | Result |
| --- | --- |
| 768 | PASS |
| 820 | PASS |
| 834 | PASS |
| 1024 | PASS |
| 1280 | PASS |
| 1366 | PASS |
| 1920 | PASS |
| 767 | PASS: UnsupportedViewport only |
| 430 | PASS: UnsupportedViewport only |
| 375 | PASS: UnsupportedViewport only |

Both-theme width sweeps covered Home, Login, Dashboard, Products/form, Predictive Analysis, Reports, Purchase Orders, Help, Notifications, and Staff POS. Account/System had both-theme desktop rendering checks at 1366; a separate full-width Account/System sweep was not performed. Phone checks covered public and authenticated roots with no visible application/modal content behind the gate. Internal table/modal scrolling remains intentional.

## Operational Regression

| Subsystem | Result And Scope |
| --- | --- |
| Product CRUD | LIVE browser PASS: disposable create, edit, search, category filter, sort, 409 protection, unreferenced delete |
| Inventory | LIVE query/render PASS; no image-induced calculation changes; live transaction delta NOT RUN |
| Stock Movements | LIVE query/render PASS; new sale/receipt movement verification NOT RUN |
| Sales History | LIVE existing-history rendering PASS; new real sale linkage NOT RUN |
| Forecasting | LIVE persisted forecast/decision/evaluation rendering PASS; image suite query regression PASS; new forecast generation NOT RUN |
| Reports | LIVE queries/rendering/charts PASS; image suite query regression PASS |
| Procurement | LIVE options and unsaved form PASS: select Product, quantity/cost, add/remove item row; no PO submitted or received |
| Users | LIVE browser PASS: disposable Staff create, edit, suspend, password reset; DB status/hash/mustChangePassword verified |
| Audit | LIVE Activity/Login History, filters, details, pagination PASS |
| Account | LIVE details/system surfaces PASS; forced-password flow passed separately; account-page password submission NOT RUN |
| Help | LIVE search, category navigation, disclosure collapse/expand, Predictive deep link PASS; fresh Staff role-filter interaction NOT RUN |
| Notifications | LIVE Admin open/refresh/item navigation PASS; LIVE Staff bell hidden PASS |

### Existing Product Delete Restriction

Product creation creates a zero-quantity StockLevel record. Its foreign key uses Restrict, so a newly created Product is already referenced and deletion returns 409. This existing behavior was preserved, not treated as an image regression.

For valid-deletion testing only, the runner removed the zero-stock reference belonging to its own disposable Product, then successfully deleted that unreferenced Product through the UI/API. One fixture left after an initial incorrect test expectation was checked for zero stock, no sales/movements/PO/forecast references, and no image before targeted cleanup. No real Product or historical transaction was removed.

## Live System Workflow

| Step | Classification |
| --- | --- |
| Admin Product create/update without image | LIVE PASS, disposable records |
| Admin Product with live image | NOT RUN |
| Staff POS sale | MOCKED PASS only |
| Sales History after new sale | NOT RUN |
| Inventory decrement after new sale | NOT RUN |
| Stock Movement after new sale | NOT RUN |
| Dashboard after new sale | NOT RUN; existing LIVE data rendering passed |
| Reports after new sale | NOT RUN; existing LIVE data rendering passed |
| PO receiving | NOT RUN |
| Inventory increment after receiving | NOT RUN |
| Sale/receiving audit propagation | NOT RUN |
| Disposable Product/User audit operations | LIVE; history retained |

A complete frontend -> Express -> PostgreSQL -> Cloudinary end-to-end LIVE PASS is explicitly **not claimed**. The provider-rotation prerequisite remains unmet.

## Performance

| Item | Result |
| --- | --- |
| Previous main | 334.83 kB |
| Current main | 334.83 kB, gzip 107.85 kB |
| Main delta | 0.00 kB |
| Products chunk | 18.49 kB, gzip 5.84 kB |
| POS chunk | 12.93 kB, gzip 4.46 kB |
| ProductImage chunk | 0.47 kB JS, gzip 0.33 kB; 0.55 kB CSS |
| Charts shared chunk | 56.85 kB |
| Vite >500 kB warning | NONE |
| Home excludes Products/POS/ProductImage chunks | PASS, production-preview network observation |
| Products chunk loads on navigation | PASS, production preview |
| POS chunk loads on navigation | PASS, production preview |
| Workspace lazy loading | Preserved |
| Images | URL-based, native lazy loading outside eager form previews |

No uncaught browser page errors were recorded in completed QA runs. No failed dynamic-import exceptions occurred. Intentional image-request failures were used for fallback checks. Exhaustive console-warning capture and live-provider log inspection are not claimed.

## Security And Build

| Check | Result |
| --- | --- |
| Frontend npm audit | PASS: 0 vulnerabilities |
| Backend npm audit | 3 HIGH findings in existing Prisma dependency chain |
| Backend npm audit --omit=dev | Same 3 HIGH findings |
| Forced audit fix | NO |
| Migration status | PASS: all 10 migrations applied, including Product image migration |
| Frontend lint | PASS |
| Frontend explicit nonincremental type-check | PASS |
| Frontend build | PASS |
| Backend type-check | PASS |
| Backend build | PASS |
| Backend lint | NOT RUN: no configured lint script/tooling |

Known advisory: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), stack exhaustion while merging recursive object graphs. Installed chain: deepmerge-ts 7.1.5 -> @prisma/config 6.19.3 -> prisma 6.19.3. All three audit entries are HIGH and derive from this chain.

Prisma is declared as a dev dependency, but @prisma/client also has an optional peer relationship to Prisma; npm reports the chain even with dev dependencies omitted. It must not be described as definitively dev-only. Source inspection finds Prisma configuration used by tooling and @prisma/client used by the API; exploitability through an application request was not established or ruled out in this acceptance pass.

The current npm audit resolver proposes a forced change to prisma 6.12.0. No compatible non-forced resolution was offered by that audit run. A separate Prisma compatibility/security update is required; no forced downgrade/upgrade was attempted here.

## Files, Cleanup, And Evidence

Created: frontend/PHASE11O-E-REPORT.md.

Files modified for application fixes: **NONE**.

Temporary QA runners were removed after verification. Browser-created disposable accounts and Products were removed. Their legitimate login/audit history was retained. The existing backend integration suite cleans only its own isolated fixtures, including its synthetic audit rows, according to its established teardown. No live Cloudinary asset was created, so this pass left no provider test asset to clean up.

Evidence is stored outside the repository under C:/Users/ADMIN/AppData/Local/Temp/:

- 11OE-browser-results.json: full theme/responsive/auth sweep.
- 11OE-detail-results.json: charts, production loading, mocked image/POS checks.
- 11OE-workflow-results.json: live disposable CRUD and administrative interactions.
- 11OE-*.png: representative screenshots.
- 11OE-backend-out.log and 11OE-backend-error.log: restarted local backend logs.

Final completed browser runs recorded **240 checkpoints, 0 failed checkpoints, and 0 uncaught page errors**: 203 broad checks, 28 detailed checks, and 9 workflow checks. This count does not convert NOT RUN requirements into passes. Initial runner selector/fixture assumptions were corrected and rerun. Final database cleanup checks found **0 Phase 11OE disposable users and 0 Phase 11OE disposable Products**. Restarted backend stderr was empty at the final check.

Business logic changed: **NO**. API changes: **NO**. Schema changes: **NO**. New dependencies: **NONE**. Credential values committed: **NO**; no commit was made.

## Remaining Limitations

1. Confirm revocation/rotation of the exposed credential without disclosing it; then perform all six live Cloudinary operations and verify the product folder.
2. Complete the safe image-backed sale and receiving acceptance workflow, including stock, history, dashboard/report, and audit propagation.
3. Resolve or formally assess the existing Prisma-chain HIGH advisory in a separately scoped compatibility update.
4. Physical tablet Safari, sub-frame logo-flash measurement, and the explicitly NOT RUN interactions above remain outside verified evidence.

**FINAL PHASE 11O STATUS: CONDITIONAL PASS.** This is not full deployment acceptance. Stopped at Phase 11O-E; no next redesign phase begun.
