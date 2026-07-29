# Performance Report

**Store:** Bold Beautiful  
**Stack:** Next.js 15 on Coolify (VPS)  
**Audit date:** July 2026  

---

## Executive Summary

The store uses sensible **HTTP caching headers** for static assets and storefront API routes. The main performance tradeoff is **`images.unoptimized: true`**, which disables Next.js Image Optimization and shifts image delivery to direct/static paths.

Build pipeline **does not enforce** TypeScript or ESLint — this affects maintainability more than runtime speed but allows type regressions to reach production silently.

No dedicated load testing or Core Web Vitals baseline was recorded in this audit.

---

## Image Delivery

**Configuration:** `next.config.ts`

```typescript
images: {
  unoptimized: true,
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 2592000,
  // remotePatterns: unsplash, placehold.co
}
```

| Aspect | Impact |
|--------|--------|
| `unoptimized: true` | No `/_next/image` proxy resizing; full-size images served as stored |
| Rationale (documented in config) | Simplifies Coolify cutover; local disk storage instead of Supabase CDN |
| Tradeoff | Larger payloads on mobile; no automatic width/format negotiation |
| Cache header for `/_next/image` | Present (30 days) but largely unused while unoptimized |

**Storage:** Product images served from `/storage/v1/object/public/...` (local disk). No CDN layer in front of VPS documented.

**Recommendation:** Re-enable optimization once `STORAGE_PUBLIC_URL` and Sharp pipeline are stable on VPS, or put Cloudflare/similar in front of static assets.

---

## HTTP Caching

**Global security headers** on all routes (X-Frame-Options, XSS, nosniff, referrer policy).

| Route pattern | Cache-Control |
|---------------|---------------|
| `/_next/static/*` | `public, max-age=31536000, immutable` |
| `/_next/image` | `public, max-age=2592000, stale-while-revalidate=86400` |
| `/api/storefront/*` | `public, s-maxage=900, stale-while-revalidate=1800` (15 min CDN, 30 min SWR) |
| `/service-worker.js` | `no-cache, no-store, must-revalidate` |

Storefront product/category APIs (`app/api/storefront/`) benefit from 15-minute edge cache — good for catalog reads under traffic.

---

## Database & API Layer

| Pattern | Notes |
|---------|-------|
| Connection | `pg` pool (`lib/db/pool.ts`) — single app instance on Coolify |
| REST shim | In-process HTTP to `/rest/v1` — adds hop vs direct pool but enables ACL |
| Shop query fix | Removed invalid `ORDER BY products.position` that could fail or scan unnecessarily |
| PDP | Filters `status=active` — reduces dead-row reads |
| Embed selects | `supabase-compat.ts` orders `product_images` by `position` only when column exists |

No query performance profiling (EXPLAIN ANALYZE) was run during this audit.

---

## Client & Storefront

| Area | Observation |
|------|-------------|
| Service worker | Versioned cache (`sw-v2.5-boldbeautiful`); SW file no-cache |
| Framer Motion | Used in UI — monitor bundle size on key pages |
| Google Maps | `@react-google-maps/api` — load only on pages that need maps |
| Image compression | `browser-image-compression` available for admin uploads |
| React 19 + Next 15 | Current stable pairing |

---

## Build & Deploy

| Setting | Value | Performance / quality impact |
|---------|-------|------------------------------|
| `typescript.ignoreBuildErrors` | `true` | Broken types can ship; no compile-time catch |
| `eslint.ignoreDuringBuilds` | `true` | Lint issues don't block deploy |
| Sharp | In dependencies | Available but bypassed for `next/image` while unoptimized |

**Note:** These are temporary cutover settings documented in `next.config.ts`. They do not slow runtime but reduce pre-deploy signal.

---

## Payment & Background Jobs

| Endpoint | Limit |
|----------|-------|
| Payment initiate | Rate limited (`RATE_LIMITS.payment`) |
| Moolre callback | Rate limited (`RATE_LIMITS.callback`) |
| Payment reminders cron | Batch limit 50 orders per run |

Appropriate for moderate order volume; monitor if cron backlog grows.

---

## Known Bottlenecks & Risks

1. **Unoptimized images** — primary user-facing perf concern on product-heavy pages.
2. **Single VPS** — no horizontal scaling documented; Postgres and app co-located on fleet host.
3. **REST HTTP loopback** — server components calling `/rest/v1` via HTTP add latency vs direct pool (acceptable at current scale).
4. **No CDN** — all assets from origin unless Traefik/Coolify adds caching.
5. **Empty catalog period** — not perf-related but homepage/shop may appear fast with zero products.

---

## Recommendations (Priority)

| Priority | Action | Expected gain |
|----------|--------|---------------|
| High | Enable `next/image` optimization + width sizes | LCP, bandwidth |
| Medium | Cloudflare or reverse-proxy cache for `/storage/v1/object/public/*` | Repeat visit speed |
| Medium | Direct pool reads for hot server paths (bypass HTTP shim) | TTFB on SSR pages |
| Low | EXPLAIN ANALYZE on shop/home queries after catalog seed | Query tuning |
| Low | Re-enable TS/ESLint builds | Prevents perf regressions from bad code paths |

---

## Measurement Gap

This report is based on **configuration review**, not Lighthouse scores or load tests. Before marketing pushes, run:

- Lighthouse on `/`, `/shop`, `/product/[slug]`
- WebPageTest from Ghana-target region (primary market: GHS)
- k6 or similar on `/api/storefront/products` under cache miss

---

## Related Documents

- `docs/FULL_SYSTEM_AUDIT.md`
- `docs/SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md`
