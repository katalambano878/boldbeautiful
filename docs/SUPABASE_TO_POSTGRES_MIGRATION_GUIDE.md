# Bold Beautiful — Supabase → plain Postgres cutover

**Shape:** A — shimmed HTTP client → app `/rest/v1`, `/auth/v1`, `/storage/v1` + `DATABASE_URL`  
**Repo:** `katalambano878/boldbeautiful`  
**Local folder:** `websites/boldbeautiful`  
**Branch:** `staging/plain-postgres`  
**Coolify:** `boldbeautiful-app` (`899doc2g688wg8mknw5okj5y`)  
**Prod origin:** `https://www.boldnbeautiful.store` (also `https://boldnbeautiful.store`)  
**DB:** `store_boldbeautiful` on `fleet-postgres`

See also: store hardening playbook in the big-vps workspace (`STORE_HARDENING_PLAYBOOK.md`).

## Env cutover trio (set together in Coolify)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | `postgresql://store_boldbeautiful:***@fleet-postgres:5432/store_boldbeautiful` (prefer direct PG, not pgbouncer IPv6) |
| `NEXT_PUBLIC_USE_PLAIN_PG` | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin** (`https://www.boldnbeautiful.store`), not `*.supabase.co` |

Also required: `AUTH_JWT_SECRET` / `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (compat), `STORAGE_ROOT=/app/storage`, `STORAGE_PUBLIC_URL`, Resend + Moolre keys.

## Hardening / cutover status (Jul 2026)

- [x] Shape A scaffold: `lib/db/*`, `/rest` `/auth` `/storage`, plain-PG middleware + `supabase-admin`
- [x] Phase A: `public/service-worker.js` `sw-v2.5-boldbeautiful`, `lib/format-money.ts`, `app/error.tsx`, `app/admin/error.tsx`
- [x] `images.unoptimized: true`; drop `*.supabase.co` / `via.placeholder.com`; SW no-cache headers
- [x] Added deps: `pg`, `bcryptjs`, `jose`
- [x] UUID `id` defaults on `store_boldbeautiful`
- [x] Coolify prod app + `fleet db provision` + deploy (image SHA `942cdf8…`)
- [x] Custom DNS → VPS; Coolify FQDN + Traefik labels for apex + www
- [x] `DATABASE_URL` → `fleet-postgres:5432` (REST returns 200)
- [x] `mark_order_paid` RPC applied
- [x] Persistent storage: host `/data/coolify/boldbeautiful/storage` → `/app/storage`
- [ ] **Catalog data restore** — original Supabase project `eiudpqrtwtifotxbylnh` is **gone** (NXDOMAIN / not in org). DB has schema only (0 products). Re-seed via Admin or restore from a dump if one exists.
- [ ] Place test order after catalog is loaded

## Verify

```bash
BASE=https://www.boldnbeautiful.store
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/shop"
curl -s "$BASE/service-worker.js" | head -n 3
# expect CACHE_VERSION = sw-v2.5-boldbeautiful
curl -s "$BASE/rest/v1/products?select=id&limit=1"
# expect JSON array (empty until catalog restored)
```
