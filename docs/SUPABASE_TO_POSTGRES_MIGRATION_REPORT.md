# Supabase → Plain Postgres Migration Report

**Store:** Bold Beautiful  
**Migration shape:** A (HTTP shim)  
**Branch:** `staging/plain-postgres`  
**Status:** Deployed to production; schema live; catalog re-seed pending  

---

## Executive Summary

Bold Beautiful completed a **Shape A** migration: the app no longer calls Supabase Cloud. Instead, a compatibility layer routes the existing Supabase-style client to in-app HTTP endpoints backed by plain PostgreSQL.

**Outcome:** Runtime has **zero `@supabase/*` packages**. No Prisma. Database is `store_boldbeautiful` on the fleet-postgres instance. Production serves from Coolify app `boldbeautiful-app`.

**Gap:** Original Supabase project is gone; database has schema but catalog data must be re-seeded or restored from backup.

---

## Migration Shape A

```
Browser / Server Component
        │
        ▼
lib/db/http-client.ts  (targets NEXT_PUBLIC_SUPABASE_URL = app origin)
        │
        ▼
┌───────────────────────────────────────────┐
│  /rest/v1/*     PostgREST-shaped CRUD     │
│  /auth/v1/*     Sign-up, login, JWT       │
│  /storage/v1/*  Local disk object store   │
└───────────────────────────────────────────┘
        │
        ▼
lib/db/supabase-compat.ts  →  pg pool  →  store_boldbeautiful
```

### Why Shape A

- Minimizes storefront/admin rewrites — existing `.from('table').select()` patterns preserved.
- Avoids ORM migration cost (no Prisma).
- Keeps auth and storage under app control on the VPS.

---

## What Was Removed

| Before | After |
|--------|-------|
| `@supabase/supabase-js` | `lib/db/http-client.ts` |
| Supabase Auth service | `lib/db/auth.ts` + JWT (`jose`) |
| Supabase Storage | `lib/db/storage.ts` + `STORAGE_ROOT` |
| Supabase RLS policies | `lib/db/rest-acl.ts` allowlist |
| `*.supabase.co` URLs | App origin in `NEXT_PUBLIC_SUPABASE_URL` |
| Remote PostgREST | In-app `/rest/v1/[table]` routes |

---

## Infrastructure

| Resource | Detail |
|----------|--------|
| VPS | big VPS (Coolify + fleet) |
| App | `boldbeautiful-app` |
| Database | `store_boldbeautiful` via `fleet db provision` |
| Storage | `/data/coolify/boldbeautiful/storage` → `/app/storage` |
| Domains | `boldnbeautiful.store`, `www.boldnbeautiful.store` |
| Service worker | `sw-v2.5-boldbeautiful` |

---

## Environment Cutover Trio

These three must be set together in Coolify (values are project-specific; names only):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection to `store_boldbeautiful` |
| `NEXT_PUBLIC_USE_PLAIN_PG` | `true` — enables shim client |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin** (not `*.supabase.co`) |

Additional required variables are listed in `docs/REPAIR_CHANGELOG.md`.

Compat keys (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) may remain for client header compatibility but do not point to Supabase Cloud.

---

## Schema & RPC

- UUID `id` defaults applied on core tables.
- **`mark_order_paid`** RPC — atomic paid transition + stock decrement.
- **`update_customer_stats`** — post-payment customer aggregation.
- **`upsert_customer_from_order`** — guest checkout customer upsert (public RPC).

Database functions are invoked via `/rest/v1/rpc/[fn]` with ACL gating (admin-only except public RPCs).

---

## Security Layer (Post-Migration)

Supabase RLS is **not replicated**. Access control is application-side:

- **Public read:** products, categories, reviews, CMS tables, coupons, etc.
- **Anon insert:** orders, order_items, customers, support, cart, wishlist, addresses.
- **Customer read/write:** scoped tables; orders PATCH blocked for customers.
- **Admin/staff:** full REST access.
- **Write sanitization:** order inserts force `payment_status=pending`.

See `lib/db/rest-acl.ts` and `docs/REPAIR_CHANGELOG.md` for the hardening pass details.

---

## Completed Checklist

- [x] Shape A scaffold (`lib/db/*`, route handlers)
- [x] Middleware + admin client retargeted
- [x] `pg`, `bcryptjs`, `jose` dependencies
- [x] Coolify prod deploy + DNS
- [x] `DATABASE_URL` → fleet-postgres (REST returns 200)
- [x] Persistent storage volume
- [x] `mark_order_paid` RPC
- [x] REST ACL + gated routes (Jul 2026 hardening)
- [x] Storefront/admin bug fixes (featured, shop, variants, POS, etc.)

## Outstanding

- [ ] **Catalog restore** — seed via admin or `scripts/seed-catalog.mjs`, or restore from dump
- [ ] End-to-end test order after catalog loaded
- [ ] Re-enable TS/ESLint build gates
- [ ] Server-side checkout (recommended before high traffic)

---

## Verification Commands

```bash
BASE=https://www.boldnbeautiful.store

curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/shop"
curl -s "$BASE/service-worker.js" | head -n 3
curl -s "$BASE/rest/v1/products?select=id&limit=1"
```

Expected: HTTP 200 on pages; SW version `sw-v2.5-boldbeautiful`; products JSON array (empty until seeded).

---

## Rollback Notes

Rollback to Supabase Cloud is **not practical** — original project is unavailable. Forward path is plain Postgres on VPS with fleet backups in `/data/fleet/backups`.

---

## References

- Operational guide: `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`
- System audit: `docs/FULL_SYSTEM_AUDIT.md`
- Env names: `docs/REPAIR_CHANGELOG.md`
