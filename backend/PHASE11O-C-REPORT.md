# PHASE 11O-C - PRODUCT IMAGE STORAGE BACKEND REPORT

Date: September 9, 2026

## Result

Definition of Done: **PASS for the scoped implementation and local database/mock-provider QA**, with live Cloudinary verification NOT RUN and an existing npm audit finding unresolved. This is not a claim of a clean dependency audit or live-provider deployment certification.

Implemented backend/storage foundation only. No frontend image UI, POS image layout, Home/Login, theme, or logo changes.

## Files

Created, relative to `backend/`:

- `prisma/migrations/20260909000000_add_product_image_fields/migration.sql`
- `src/services/productImageStorage.ts`
- `src/middleware/productImageUpload.ts`
- `src/controllers/productImageController.ts`
- `tests/productImages.test.ts`
- `PHASE11O-C-REPORT.md`

Modified:

- `prisma/schema.prisma`
- `src/controllers/productController.ts`
- `src/routes/productRoutes.ts`
- `.env.example`
- `.gitignore`
- `package.json`
- `package-lock.json`
- `README.md`

Files removed: NONE. Prisma Client and backend build output were regenerated in their ignored directories. Existing frontend worktree changes were preserved.

## Storage Architecture

- Provider: Cloudinary.
- Folder: `king-of-clouds/products`.
- Flow: authenticated multipart request -> bounded memory buffer -> Cloudinary upload stream -> authoritative HTTPS URL/public ID -> Product metadata.
- Filesystem image persistence: NONE. No upload directory, base64 database storage, or binary columns.
- `uploadProductImage` and `deleteProductImage` centralize provider operations. Configuration is lazy and reused after successful initialization.
- Uploads use provider-generated unique identifiers, no raw filename public IDs, no overwrite, no destructive cropping, no fabricated cache-busting timestamps.
- Returned `secure_url` and `public_id` supply the stored values. The client cannot submit a remote URL through the image endpoint.

The implementation follows the provider's [Node upload-stream API](https://cloudinary.com/documentation/node_image_and_video_upload) and [asset deletion API](https://cloudinary.com/documentation/image_upload_api_reference). Multipart handling uses [Multer memory storage and limits](https://expressjs.com/en/resources/middleware/multer/).

## Prisma

- Added nullable `Product.imageUrl String?` and `Product.imagePublicId String?`.
- Normal additive migration: `20260909000000_add_product_image_fields`.
- Applied with `prisma migrate deploy` against local development PostgreSQL `localhost:5432/capstone_db`.
- Migration status: up to date; no reset performed and no unrelated constraints changed.
- Existing rows: six products before migration, six afterward, all six with null image fields.
- Prisma Client regenerated successfully. A running local API worker briefly held the Windows engine DLL; regeneration succeeded after releasing that worker. The existing watcher restarted the API; health check returned 200.
- Disposable test records were removed; final check found zero test products and zero test users, with the original six products still present and image fields null.

## Environment And Dependencies

- Server-only variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `.env.example` contains empty placeholders only. `.env` and `.env.*` are ignored, with `.env.example` explicitly allowed.
- Missing configuration: storage-dependent endpoints return a safe `503` message; ordinary Product CRUD continues working. Deleting an already-empty image remains `204` without configuration.
- No Vite secrets, frontend provider configuration, raw provider errors in HTTP responses, or credentials in audit events/log messages.
- Dependencies added: `cloudinary ^2.11.0`, `multer ^2.3.0`; development typings `@types/multer ^2.2.0`.
- No frontend upload or image-processing dependencies added.
- Existing transitive `qs` updated within its compatible dependency range to resolve its audit finding. No forced Prisma downgrade or major dependency override was performed.

## API Contract

| Endpoint | Authorization | Success |
| --- | --- | --- |
| `POST /api/products/:id/image` | Admin | `200 { "imageUrl": "https://..." }` |
| `DELETE /api/products/:id/image` | Admin | `204`, including an existing product with no image |
| Existing Product list/detail | Admin and Staff, unchanged | Product includes `imageUrl: string | null` |

- Normal JSON create/edit remain unchanged apart from additive nullable response metadata. Image values supplied in JSON cannot assign storage metadata.
- Public Product responses expose `imageUrl`, not `imagePublicId`. The upload response also keeps the public ID internal.
- POS already consumes `/api/products`, so the same Staff-authorized response is image-ready without frontend changes.
- Existing analytical projections and business calculations were not expanded or rewritten.

## Validation And Security

- Field: exactly one `image` file; extra file fields and non-image form fields are rejected.
- Maximum: 5 MiB, 5,242,880 bytes; user-facing message uses 5 MB.
- Allowed MIME: JPEG, PNG, WebP only.
- Signature checks: JPEG magic bytes, PNG signature, WebP RIFF/WEBP plus VP8 chunk marker. These are signature checks, not a full local image decoder; Cloudinary also restricts image formats.
- TXT, SVG, HTML, PDF, GIF, octet-stream, and spoofed PNG content are rejected.
- Authentication/RBAC occurs before multipart buffering. Staff cannot upload or remove images.
- Product is looked up before provider persistence; missing product returns `404`.
- No file/malformed multipart: `400`; unsupported type/signature: `415`; oversize: `413`; unauthenticated: `401`; forbidden: `403`; provider failure: `502`; missing provider config: `503`; database failure: `500`.
- Conditional image update conflict: `409`, instructing the caller to reload and retry.
- Rate limit: 20 image mutations per authenticated Admin per 15 minutes per process, enforced before multipart parsing. No existing shared mutation limiter was available. Responses include `429` and `Retry-After`; the bounded in-memory store is not a cross-instance rate limiter.

## Replacement And Removal Safety

- Replacement: upload NEW -> conditionally commit NEW metadata and audit event -> best-effort delete OLD -> success.
- Database/audit failure: rollback metadata and attempt to delete the newly uploaded asset; preserve the previous metadata/asset.
- Old cleanup failure after commit: log product/public identifiers only, keep the new metadata, and return success. An orphan may require operational cleanup.
- Compare-and-swap checks both previous URL and public ID, protecting concurrent image changes across application instances.
- Explicit remove: delete provider asset first, accepting `ok` or `not found`, then conditionally clear both fields with the audit event. No-image removal is idempotent `204`.
- Failed provider deletion leaves metadata intact and returns a safe error for retry.
- Transient database failure after remote deletion triggers one metadata/audit retry. Persistent database failure is logged as requiring reconciliation and returns an error; retry DELETE after recovery. Remote storage and PostgreSQL cannot commit atomically, so a sustained outage can temporarily leave stale metadata. No automatic background reconciliation queue was added.
- A concurrent replacement is never cleared by a stale remove request.

## Product Deletion And Audit

- Existing referenced-record protection and both existing `409` error mappings remain unchanged.
- Product deletion must commit successfully, including its existing audit event, before any Cloudinary cleanup.
- Cleanup uses the public ID returned by the actual Product delete, avoiding a stale pre-delete image snapshot during concurrent replacement.
- Referenced Product deletion does not touch Cloudinary.
- Remote cleanup failure after successful Product deletion is logged and does not turn the successful DELETE into a `500`.
- Image mutations use existing `ADMIN_ACTION` / `UPDATE` / `PRODUCT` audit conventions with operation metadata `PRODUCT_IMAGE_UPLOADED`, `PRODUCT_IMAGE_REPLACED`, or `PRODUCT_IMAGE_REMOVED`.
- Audits include safe entity ID/label and before/after URL only, not binary data, provider credentials, or the full provider response.

## Verification

Integration tests use actual HTTP middleware, JWT/RBAC, and local PostgreSQL, with only the Cloudinary SDK boundary mocked. The suite requires explicit `RUN_DATABASE_IMAGE_TESTS=1`, uses uniquely named disposable records, refuses non-local database hosts, and cleans up its own records.

Test result: **20 passed, 0 failed** (19 scenarios plus the parent integration test).

| Scenario | Result |
| --- | --- |
| JPEG / PNG / WebP buffer uploads and persisted metadata | PASS, mocked provider |
| Missing configuration with ordinary CRUD available | PASS |
| No file / invalid type / spoofed signature / oversize | PASS |
| Duplicate file, unexpected field, client metadata rejection | PASS |
| Missing product | PASS |
| Admin upload and remove | PASS |
| Staff upload and remove rejected with 403 | PASS |
| Unauthenticated upload and remove rejected with 401 | PASS |
| Staff Product read and imageUrl-only exposure | PASS |
| Replacement metadata and old cleanup ordering | PASS |
| Provider upload failure preserving old image | PASS |
| Database failure compensation | PASS |
| Audit failure rollback and compensation | PASS |
| Old cleanup failure preserving successful replacement | PASS |
| Concurrent replacement conflict | PASS |
| Image removal, remote not-found, repeat removal | PASS |
| Provider delete failure preserving metadata | PASS |
| Transient DB failure after remote delete, then retry | PASS |
| Product list/detail/create/PUT/normal delete | PASS |
| Referenced Product with image: 409, no remote delete | PASS |
| Successful Product delete: cleanup after DB deletion | PASS |
| Product delete cleanup failure still returns 204 | PASS |
| Staff POS Product/Inventory loading and Sales reads | PASS |
| Forecast insights and Reports summary queries | PASS |
| Mutation rate limit | PASS |

Live Cloudinary test: **NOT RUN**. The three provider credentials are absent in the local configuration. No mocked result is represented as a live upload/delete success.

POS regression covers its existing data loading endpoints, not a new browser image UI. No sale creation/calculation or inventory mutation was changed. Forecast/report checks use real local database queries; no forecast calculation changes were made.

## Quality Checks

- Backend lint: NOT CONFIGURED. The backend has no existing lint script/config; no lint framework was added solely for this phase.
- Backend `npx tsc --noEmit`: PASS.
- Additional strict TypeScript check of the test file and its imports: PASS.
- Backend `npm run build`: PASS.
- Prisma generation and migration status: PASS.
- `git diff --check`: PASS.
- Frontend checks: not applicable; no frontend source/types/dependencies changed in this phase.
- `npm audit`: **NOT CLEAN**. Three high-severity entries remain in the existing `deepmerge-ts -> @prisma/config -> prisma` chain. The underlying advisory is [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). npm proposes a forced downgrade to Prisma 6.12.0, outside this storage phase. The same chain is still reported with `--omit=dev`; no clean production audit is claimed.

## Scope And Remaining Work

- Backend changes: YES.
- API changes: YES, additive image endpoints and nullable Product image URL.
- Schema changes: YES, two nullable Product fields.
- Frontend UI changes: NONE.
- Business calculation changes: NO.
- Required before live image use: configure Cloudinary, restart API, and verify live provider upload/replacement/removal.
- Operational follow-up: review the existing Prisma dependency advisory; monitor best-effort cleanup/reconciliation logs and apply a shared gateway limit when scaling across API instances.
- Phase 11O-D: Product upload UI and POS images/fallback.
- Phase 11O-E: final brand/image/theme regression.

Stopped at Phase 11O-C; no Product/POS image UI implemented.
