# Bold Beautiful — Supabase → plain Postgres cutover

**Shape:** A — shimmed `@supabase/supabase-js` → app `/rest/v1`, `/auth/v1`, `/storage/v1` + `DATABASE_URL`  
**Repo:** `katalambano878/boldbeautiful`  
**Local folder:** `websites/boldbeautiful`  
**Branch:** `staging/plain-postgres`  
**Coolify:** not created yet (needs owner UI / staging app)  

See also: store hardening playbook in the big-vps workspace (`STORE_HARDENING_PLAYBOOK.md`).

## Env cutover trio (set together in Coolify)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | `postgresql://…@fleet-postgres:5432/<db>` |
| `NEXT_PUBLIC_USE_PLAIN_PG` | `true` |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin** (sslip or custom domain), not `*.supabase.co` |

Also required: `AUTH_JWT_SECRET` / `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (compat), `STORAGE_ROOT` / `STORAGE_PUBLIC_URL`, Resend + payment keys (Stripe present in repo — keep existing vars).

## Hardening notes (Jul 2026)

- [x] Shape A scaffold: `lib/db/*`, `/rest` `/auth` `/storage`, plain-PG middleware + `supabase-admin`
- [x] Phase A: `public/service-worker.js` `sw-v2.5-boldbeautiful`, `lib/format-money.ts`, `app/error.tsx`, `app/admin/error.tsx`
- [x] `images.unoptimized: true`; drop `*.supabase.co` / `via.placeholder.com`; SW no-cache headers
- [x] Added deps: `pg`, `bcryptjs`, `jose`
- [x] Phase B: money sweep, payment-reminders → `supabaseAdmin`, OrderHistory Track/Reorder/Invoice/Help
- [x] UUID `id` defaults migration: `supabase/migrations/20260726170000_uuid_id_defaults.sql` (run as DB owner after restore — see playbook §1a)
- [ ] Coolify staging app + `fleet db provision` + first deploy
- [ ] Place test order after UUID defaults applied

## Verify (once staging exists)

```bash
BASE=https://<boldbeautiful-staging-host>
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/shop"
curl -s "$BASE/service-worker.js" | head -n 3
# expect CACHE_VERSION = sw-v2.5-boldbeautiful
```
