# Payment & Callback Audit

**Store:** Bold Beautiful  
**Active gateway:** Moolre  
**Currency:** GHS  
**Audit date:** July 2026  

---

## Executive Summary

Checkout is **Moolre-only**. The payment flow creates orders client-side, then initiates Moolre with a **DB-trusted amount**. Payment confirmation relies on Moolre callback (primary) and API verify (secondary). Recent hardening closed redirect-trust and callback-secret gaps.

**Hubtel:** not present in codebase.  
**Paystack / Stripe / PayPal:** API routes exist but are **not wired in checkout** — enabling them without DB-amount integrity would reintroduce client-trust risk.

**Remaining gap:** no automated webhook tests; SMS confirmations may duplicate if callback and verify race.

---

## Active Flow (Moolre)

```
Checkout (client)
  │  POST /rest/v1/orders + order_items  (cart-derived totals)
  ▼
Pay page
  │  POST /api/payment/moolre  { orderId }
  ▼
Initiate handler
  │  Reads order.total from DB (not client amount)
  │  Stores metadata.last_moolre_externalref
  │  Redirects user to Moolre authorization_url
  ▼
User pays on Moolre
  │
  ├─► POST /api/payment/moolre/callback  (server webhook)
  │     mark_order_paid RPC → notifications
  │
  └─► Redirect → /order-success?payment_success=true
        POST /api/payment/moolre/verify  (client-triggered backup)
```

---

## Endpoint Reference

| Route | Method | Role |
|-------|--------|------|
| `/api/payment/moolre` | POST | Initiate payment link |
| `/api/payment/moolre/callback` | POST | Moolre webhook |
| `/api/payment/moolre/verify` | POST | Post-redirect API confirmation |
| `/api/cron/payment-reminders` | GET | Unpaid order SMS (cron, secret-gated) |

---

## Moolre Initiate (`/api/payment/moolre`)

**Trust model (fixed):**

- Loads order by `order_number` from DB via admin client.
- Uses `order.total` (via `asNumber`) — **never accepts client-supplied amount**.
- Rejects already-paid or zero/negative totals.
- Generates unique external ref: `{orderId}-R{timestamp}` for retry safety.
- Persists `metadata.last_moolre_externalref` and `last_payment_attempt_at`.
- Callback URL: `{NEXT_PUBLIC_APP_URL}/api/payment/moolre/callback`
- Redirect URL: `{NEXT_PUBLIC_APP_URL}/order-success?order={orderId}&payment_success=true`

**Required env:** `MOOLRE_API_USER`, `MOOLRE_API_PUBKEY`, `MOOLRE_ACCOUNT_NUMBER` (names only).

**Rate limit:** applied via `lib/rate-limit.ts`.

---

## Moolre Callback (`/api/payment/moolre/callback`)

**Primary payment confirmation path.**

| Check | Behavior |
|-------|----------|
| Rate limit | Per-client identifier |
| Order reference | From `data.externalref`; strips `-R{timestamp}` retry suffix |
| Success detection | Requires `data.txtstatus === 1` OR (`status === 1` + success message) — **not message alone** |
| Callback secret | If `MOOLRE_CALLBACK_SECRET` is set, `body.secret` **must match** or 403 |
| Amount | Compares callback amount to `existingOrder.total`; mismatch → 400, **not marked paid** |
| Idempotency | Already-paid orders return success without re-processing |
| Side effects | `mark_order_paid` RPC, `update_customer_stats`, `sendOrderConfirmation` |

**Failure path:** sets `payment_status=failed` with metadata reason.

---

## Moolre Verify (`/api/payment/moolre/verify`)

**Secondary confirmation** (order-success page).

| Check | Behavior |
|-------|----------|
| Already paid | Returns success immediately |
| Moolre API | POST `https://api.moolre.com/embed/status` with `last_moolre_externalref` or order number |
| Redirect trust | **`fromRedirect` alone does NOT mark paid** — requires API confirmation |
| Mark paid | Only after `moolreApiVerified === true` |
| Notifications | Same as callback (see duplicate risk below) |

---

## Checkout Integration

File: `app/(store)/checkout/page.tsx`

- `paymentMethod` state is typed `'moolre'` only.
- After order insert, calls `/api/payment/moolre` with `{ orderId: orderNumber, customerEmail }`.
- Order payload (subtotal, tax, shipping, total, line items) is **computed client-side** from cart.
- REST ACL forces `payment_status=pending` on insert — clients cannot self-mark paid.

**Risk:** Order totals on the record may not match catalog prices if cart is tampered. Moolre charges DB total at initiate time, but fulfillment/reporting sees client-written order rows.

---

## Alternate Gateways (Not Active)

| Gateway | Initiate route | Verify/capture route | Checkout wired? | Amount source |
|---------|----------------|----------------------|-----------------|---------------|
| Paystack | `/api/payment/paystack` | `/api/payment/paystack/verify` | **No** | **Client body `amount`** |
| Stripe | (checkout session) | `/api/payment/stripe/success` | **No** | Route-dependent |
| PayPal | `/api/payment/paypal` | `/api/payment/paypal/capture` | **No** | Route-dependent |
| Hubtel | — | — | **Absent** | — |

`order-success/page.tsx` retains Paystack reference handling for legacy redirects, but checkout never selects Paystack.

**Before wiring alternates:** refactor all initiate routes to load `order.total` from DB (Moolre pattern) and add amount verification on verify/capture.

---

## Notifications & SMS

- Confirmation: `sendOrderConfirmation()` in `lib/notifications.ts`
- Channels: Resend (email), Moolre SMS API
- Payment reminders: cron job at `/api/cron/payment-reminders` (requires `CRON_SECRET`)

**Duplicate SMS risk:** Neither callback nor verify checks a `confirmation_sent` flag before sending. Concurrent or sequential calls can duplicate customer SMS/email.

---

## Cron: Payment Reminders

- Finds unpaid orders older than 15 minutes with `payment_reminder_sent=false`
- Sends payment link SMS via `sendPaymentLink`
- **Requires `CRON_SECRET`** — returns 503 if unset, 401 if bearer mismatch

---

## Security Controls Summary

| Control | Status |
|---------|--------|
| DB-trusted pay amount (Moolre initiate) | ✅ |
| Callback secret enforcement (when configured) | ✅ |
| Amount mismatch rejection on callback | ✅ |
| Stricter success status parsing | ✅ |
| No redirect-only verify | ✅ |
| Rate limiting on payment/callback | ✅ |
| Client cannot set `payment_status=paid` via REST | ✅ |
| Automated callback tests | ❌ |
| SMS/email idempotency | ❌ |
| Server-side order total validation | ❌ |

---

## Recommended Actions

1. Add `confirmation_sent_at` (or similar) guard in `mark_order_paid` or notification sender.
2. Implement `/api/checkout/create-order` — server computes line items and totals from DB prices.
3. Add integration tests for callback scenarios (success, bad secret, amount mismatch, duplicate).
4. If enabling Paystack/Stripe/PayPal — mandatory DB-amount refactor first.
5. Document Moolre webhook URL in merchant dashboard: `{APP_URL}/api/payment/moolre/callback`.

---

## Related Documents

- `docs/FULL_SYSTEM_AUDIT.md` — system-wide risks
- `docs/REPAIR_CHANGELOG.md` — security repair details
- `docs/SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` — data layer context
