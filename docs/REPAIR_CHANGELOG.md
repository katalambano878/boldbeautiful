# Security Repair Changelog

**Store:** Bold Beautiful  
**Session:** July 2026 hardening pass  
**Branch:** `staging/plain-postgres`  

This document records security and integrity repairs applied during the post-migration audit. Values are **not** included — env variable **names** only.

---

## Summary

Replaced implicit Supabase RLS trust with explicit REST ACL, hardened Moolre payment paths, locked down bootstrap/cron/storage endpoints, and tightened storefront product visibility.

---

## Repairs (This Session)

### 1. REST ACL — `lib/db/rest-acl.ts` (new)

- Replaces Supabase Row Level Security with JWT role gates and table allowlists.
- Roles: `anon`, `customer`, `staff`, `admin`.
- Public read set for catalog/CMS tables.
- Anon insert allowed for checkout-related tables (orders, order_items, customers, etc.).
- Customer PATCH blocked on `orders` — prevents payment_status escalation.
- `sanitizeWritePayload()` forces `payment_status=pending` on order inserts and strips non-allowlisted keys.

### 2. REST route gating — `app/rest/v1/[table]/route.ts`, `app/rest/v1/rpc/[fn]/route.ts`

- All table and RPC requests pass through `authorizeTable()` / `authorizeRpc()`.
- Write payloads sanitized for non-admin actors.
- Admin/staff retain full access.

### 3. Moolre initiate — `app/api/payment/moolre/route.ts`

- **Before:** Could trust client-supplied amount.
- **After:** Loads `order.total` from database; rejects invalid/already-paid orders.
- Persists `metadata.last_moolre_externalref` for verify API lookups.

### 4. Moolre verify — `app/api/payment/moolre/verify/route.ts`

- **Before:** Browser redirect (`fromRedirect`) treated as payment proof.
- **After:** Marks paid only after Moolre API status confirmation. Redirect alone is logged and ignored.

### 5. Moolre callback — `app/api/payment/moolre/callback/route.ts`

- If `MOOLRE_CALLBACK_SECRET` is configured, request must include matching `body.secret`.
- Rejects amount mismatches against DB order total (> 0.01 tolerance).
- Stricter success check: requires transaction status fields, not message text alone.
- Idempotent for already-paid orders.

### 6. seed-admin — `app/api/seed-admin/route.ts`

- **Before:** Potential bootstrap exposure.
- **After:** Returns 404 when `SEED_ADMIN_SECRET` unset. Requires `Authorization: Bearer {SEED_ADMIN_SECRET}`. Passwords passed in request body only — not in source.

### 7. Storage upload/delete — `app/storage/v1/object/[bucket]/[...path]/route.ts`

- POST and DELETE require `admin` or `staff` JWT.
- Bucket allowlist: `products`, `categories`, `uploads`, `blog`, `cms`.

### 8. Cron payment-reminders — `app/api/cron/payment-reminders/route.ts`

- **Before:** Could run without secret in some configurations.
- **After:** Returns 503 if `CRON_SECRET` unset. Requires `Authorization: Bearer {CRON_SECRET}`.

### 9. Product detail page — `app/(store)/product/[slug]/`

- Queries filter `status=active` so draft/inactive products are not shown on PDP.

---

## Prior Fixes (Same Migration Branch, Pre-Session)

| Area | Change |
|------|--------|
| Featured products | Homepage query corrected |
| Shop listing | Removed invalid `products.position` order |
| Variant selectors | Driven by `option_names` |
| Admin POS | Money coercion via `format-money` / `asNumber` |
| Admin products list | Variants count display |
| Reviews | FK / join alignment |
| Customer detail | Data loading fixes |
| Inventory | Category filtering |
| Coupons | Column mapping |

---

## Environment Variables (Names Only)

Ensure these are set in Coolify / `.env.local`. Do not commit values.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection to `store_boldbeautiful` |
| `AUTH_JWT_SECRET` | JWT signing for auth (also accepts `JWT_SECRET`) |
| `MOOLRE_API_USER` | Moolre API authentication |
| `MOOLRE_API_PUBKEY` | Moolre API public key |
| `MOOLRE_ACCOUNT_NUMBER` | Moolre merchant account |
| `MOOLRE_MERCHANT_EMAIL` | Moolre merchant email (optional override) |
| `MOOLRE_CALLBACK_SECRET` | Webhook shared secret (enforced when set) |
| `MOOLRE_SMS_API_KEY` | SMS VAS key (falls back to `MOOLRE_API_KEY`) |
| `CRON_SECRET` | Bearer token for cron endpoints |
| `SEED_ADMIN_SECRET` | Bearer token for one-time admin bootstrap |
| `STORAGE_ROOT` | Local disk path for uploads (e.g. `/app/storage`) |
| `STORAGE_PUBLIC_URL` | Public base URL for stored objects |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL for redirects and links |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin** for HTTP client (not Supabase Cloud) |
| `NEXT_PUBLIC_USE_PLAIN_PG` | `true` to enable plain Postgres shim |
| `RESEND_API_KEY` | Transactional email |

Compat (non-secret placeholders OK): `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Optional alternates (unwired): `PAYSTACK_SECRET_KEY`, `STRIPE_*`, `PAYPAL_*`.

---

## `.env.example` Update Note

When maintaining `.env.example`, include the variables above with empty or placeholder values. Group as:

```env
# Database
DATABASE_URL=

# Auth
AUTH_JWT_SECRET=

# App URLs (NEXT_PUBLIC_SUPABASE_URL = same origin as APP_URL in Shape A)
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_USE_PLAIN_PG=true

# Storage
STORAGE_ROOT=
STORAGE_PUBLIC_URL=

# Moolre payments + SMS
MOOLRE_API_USER=
MOOLRE_API_PUBKEY=
MOOLRE_ACCOUNT_NUMBER=
MOOLRE_MERCHANT_EMAIL=
MOOLRE_CALLBACK_SECRET=
MOOLRE_SMS_API_KEY=

# Email
RESEND_API_KEY=

# Secured endpoints
CRON_SECRET=
SEED_ADMIN_SECRET=
```

Never commit real credentials to the repository.

---

## Known Gaps (Not Fixed This Session)

- Checkout still inserts orders via client REST with cart-derived amounts.
- No automatic row ownership filter on GET `orders` for authenticated users (IDOR risk if filters omitted).
- SMS/email confirmation lacks duplicate-send protection.
- Paystack/Stripe/PayPal routes still accept client amounts — safe only while unwired.
- No automated tests for payment callbacks.

See `docs/FULL_SYSTEM_AUDIT.md` and `docs/PAYMENT_AND_CALLBACK_AUDIT.md` for details.

---

## Verification Checklist

- [ ] Unauthenticated POST to `/rest/v1/products` returns 403
- [ ] Anon order insert gets `payment_status=pending` regardless of client payload
- [ ] `/api/payment/moolre` rejects unknown order and uses DB total
- [ ] Callback with wrong secret returns 403 (when secret configured)
- [ ] Callback with wrong amount returns 400
- [ ] `/api/seed-admin` returns 404 without `SEED_ADMIN_SECRET`
- [ ] Storage upload without admin JWT returns 401
- [ ] Cron route returns 401 without bearer token
- [ ] Inactive product slug returns 404 on PDP

---

## Related Documents

- `docs/FULL_SYSTEM_AUDIT.md`
- `docs/PAYMENT_AND_CALLBACK_AUDIT.md`
- `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`
