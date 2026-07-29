# Bold Beautiful — Full System Audit

**Date:** July 2026  
**Scope:** Production store stack, data layer, payments, security posture, and known gaps  
**Branch:** `staging/plain-postgres`  
**Deployment:** Coolify app `boldbeautiful-app` → `https://www.boldnbeautiful.store`  
**Database:** `store_boldbeautiful` on fleet-postgres  

---

## Executive Summary

Bold Beautiful is a **Next.js 15** e-commerce store running on **plain Postgres** via **Shape A** compatibility shims (no Supabase runtime SDK, no Prisma). The app exposes PostgREST-shaped routes (`/rest/v1`, `/auth/v1`, `/storage/v1`) backed by `DATABASE_URL`.

**Production payment path:** Moolre only. Hubtel is absent. Paystack, Stripe, and PayPal API routes exist but are **not wired into checkout**.

**Recent state:** Storefront and admin UI fixes are shipped (featured products, shop query, variant selectors, POS money handling, inventory/coupons/reviews). A security hardening pass added REST ACL, payment integrity checks, and gated admin/cron/storage endpoints.

**Top remaining risks:** Client-side order creation (cart-derived totals), potential IDOR on authenticated order reads, incomplete SMS deduplication, and build-time type/lint checks disabled.

---

## Architecture

| Layer | Implementation |
|-------|----------------|
| Framework | Next.js 15.1 (`app/` router, React 19) |
| Database | PostgreSQL via `pg` pool (`lib/db/pool.ts`) |
| Data access | Shape A shim: `lib/db/http-client.ts` → in-app `/rest/v1` |
| Auth | JWT (`jose`, `bcryptjs`) via `/auth/v1` + `lib/db/auth.ts` |
| Storage | Local disk (`STORAGE_ROOT`) via `/storage/v1` + `lib/db/storage.ts` |
| ORM | None (raw SQL / PostgREST-shaped queries) |
| Supabase SDK | **Not used** at runtime |

### Shape A shim modules

- `lib/db/supabase-compat.ts` — query builder + embed/select parsing
- `lib/db/http-client.ts` — browser/server HTTP client targeting app origin
- `lib/db/rest-acl.ts` — table/RPC allowlist + write sanitization (replaces RLS)
- `lib/db/mode.ts` — plain-Postgres detection, JWT secret resolution
- `lib/supabase-admin.ts` — server-side admin client (in-process, not remote Supabase)

### External services

| Service | Role | Status |
|---------|------|--------|
| Moolre | Payments + SMS | **Active** (checkout) |
| Resend | Transactional email | Configured via `RESEND_API_KEY` |
| Paystack / Stripe / PayPal | Alternate gateways | Routes exist; **not in checkout** |
| Hubtel | — | **Not in codebase** |

---

## Deployment & Environment

| Item | Value |
|------|--------|
| Coolify app | `boldbeautiful-app` |
| Git branch | `staging/plain-postgres` |
| Postgres DB | `store_boldbeautiful` |
| Public URL | `https://www.boldnbeautiful.store` |
| Storage mount | Host volume → `/app/storage` |
| Env cutover | `DATABASE_URL`, `NEXT_PUBLIC_USE_PLAIN_PG=true`, `NEXT_PUBLIC_SUPABASE_URL` = app origin |

See `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` for cutover checklist and `docs/REPAIR_CHANGELOG.md` for required env variable names.

---

## Security Posture (Post-Hardening)

### Implemented

| Control | Location |
|---------|----------|
| REST ACL (allowlist + JWT roles) | `lib/db/rest-acl.ts` |
| Gated `/rest/v1/[table]` and `/rest/v1/rpc/[fn]` | `app/rest/v1/` |
| Order insert sanitization (`payment_status=pending`) | `sanitizeWritePayload()` |
| Moolre initiate: amount from DB, not client | `app/api/payment/moolre/route.ts` |
| Moolre verify: API confirmation required; redirect not trusted | `app/api/payment/moolre/verify/route.ts` |
| Moolre callback: optional secret enforcement, amount mismatch rejection | `app/api/payment/moolre/callback/route.ts` |
| seed-admin gated by `SEED_ADMIN_SECRET` + body passwords | `app/api/seed-admin/route.ts` |
| Storage write/delete: admin/staff + bucket allowlist | `app/storage/v1/object/` |
| Cron payment-reminders: `CRON_SECRET` required | `app/api/cron/payment-reminders/route.ts` |
| PDP: `status=active` filter | `app/(store)/product/[slug]/` |
| Rate limiting on payment/callback routes | `lib/rate-limit.ts` |
| Security headers | `next.config.ts` |

### Open Risks

1. **Checkout order creation via client REST** — totals and line items come from the browser cart. `payment_status` is forced to `pending`, but a malicious client could insert inflated or deflated order totals before payment initiation (Moolre uses DB total at pay time, but order record integrity is client-influenced).

2. **IDOR on order reads** — REST ACL allows authenticated customers to read `orders` table; there is no automatic `user_id` / email filter rewrite on GET. Clients must filter correctly; broad queries could expose other users' orders.

3. **SMS duplicate sends** — `sendOrderConfirmation()` has no idempotency flag; callback + verify paths can both trigger notifications on edge timing.

4. **Build quality gates off** — `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` are `true` in `next.config.ts`. Type and lint issues do not block deploys.

5. **Alternate payment routes** — Paystack/Stripe/PayPal initialize endpoints accept client-supplied amounts. Safe while unwired; risky if enabled without DB-amount pattern used by Moolre.

6. **No automated callback tests** — Payment webhook behavior is unverified by CI.

---

## Storefront & Admin (Recent Fixes)

These fixes are already deployed or merged on the migration branch:

| Area | Fix |
|------|-----|
| Homepage | Featured products query corrected |
| Shop | Removed invalid `products.position` ordering |
| PDP | Variant selectors driven by `option_names`; active-only products |
| Admin POS | Money coercion via `asNumber` / `format-money` |
| Admin products | Variants count display |
| Reviews | Foreign key / join alignment |
| Customers | Customer detail page data |
| Inventory | Category filtering |
| Coupons | Column mapping corrected |

---

## Data & Catalog

- Schema lives in `store_boldbeautiful` with UUID defaults and `mark_order_paid` RPC.
- Original Supabase project is **unavailable** (org/project gone). Catalog must be seeded via admin or restored from dump.
- Seed script available: `scripts/seed-catalog.mjs` (local output under `scripts/.seed-out/`).

---

## Testing & Quality

| Check | Status |
|-------|--------|
| Unit / integration tests | **None** for payments or REST ACL |
| TypeScript strict build | **Not enforced** (`ignoreBuildErrors: true`) |
| ESLint in CI/build | **Not enforced** (`ignoreDuringBuilds: true`) |
| Manual verification | curl checks documented in migration guide |

---

## Related Documents

| Document | Focus |
|----------|--------|
| `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` | Migration status and Shape A details |
| `PAYMENT_AND_CALLBACK_AUDIT.md` | Moolre flow, callbacks, alternate gateways |
| `PERFORMANCE_REPORT.md` | Caching, images, storefront API |
| `REPAIR_CHANGELOG.md` | Security repairs and env checklist |
| `SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` | Operational cutover playbook |

---

## Recommended Next Steps (Priority Order)

1. Server-side checkout API — compute totals from DB prices; reject client amounts.
2. Order read scoping — enforce `user_id` / email filter in REST ACL or dedicated API.
3. Notification idempotency — e.g. `confirmation_sent_at` column before SMS/email.
4. Re-enable TypeScript and ESLint in production builds after typing cleanup.
5. Add callback integration tests (Moolre success, amount mismatch, bad secret, duplicate).
6. If enabling Paystack/Stripe/PayPal — mirror Moolre DB-amount pattern before checkout wiring.
