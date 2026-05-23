# Debranding & Ownership Neutralization — Audit Summary

**Date:** 2026-02-27  
**Scope:** Full forensic-level debranding and replacement with new ownership details (Boutique, 0241766703, Momo: 0598865781).  
**Constraint:** No business logic changes; functionality preserved.

---

## 1. Removed or Neutralized Elements

### 1.1 Brand / site name
- **Removed:** All instances of "Luxury Strand Haven", "LSH Hair", "LSH".
- **Replaced with:** "Boutique" (default site name and fallbacks site-wide).

### 1.2 Contact & ownership identifiers
- **Removed:**
  - Personal email: `maame890@gmail.com` (all fallbacks).
  - Previous phone: `054 930 7736`.
  - Address: `Kwashieman- Opposite Been-To complex, Accra, GH`.
  - Image-derived identifiers (not present in repo): P.O. Box MC 1579, pobeenina2@gmail.com, 73 Davis Street Anaji–Takoradi, WS-447-0013.
- **Replaced with:**
  - **Phone:** `0241766703` (default contact phone).
  - **Momo:** `0598865781` (new `contact_momo` setting; displayed as "Momo: 0598865781" in footer and contact page).
  - **Email:** No hardcoded fallback; empty string when not set in Admin → Settings (configurable).
  - **Address:** Default fallback `Ghana` when `contact_address` not set.

### 1.3 URLs and domains
- **Removed:**  
  `https://luxury-strand-haven.vercel.app`, `https://www.instagram.com/luxurystrandhaven`, `https://www.facebook.com/luxurystrandhaven`, `https://www.tiktok.com/@luxurystrandhaven`, `luxurystrandhaven.com`, `https://www.google.com/maps/search/Luxury+Strand+Haven+Ghana`.
- **Replaced with:**  
  - Base URL: `https://example.com` (placeholder; override with `NEXT_PUBLIC_APP_URL`).
  - Social `sameAs`: `[]` (empty; add real links via Admin or env as needed).
  - OG URL in opengraph-image: `example.com`.

### 1.4 Twitter / Open Graph
- **Removed:** `@luxurystrandhaven` (creator/site).
- **Replaced with:** `@store` (neutral placeholder).

### 1.5 Structured data (JSON-LD)
- Organization, WebSite, FAQPage, Store schemas: all `name` and brand references set to "Boutique"; `sameAs` set to `[]`; `hasMap` set to generic `https://www.google.com/maps`; `alternateName` set to "Boutique".

### 1.6 Metadata and SEO
- **Layout (`app/layout.tsx`):** Default title, description, keywords, Open Graph, and Twitter card use "Boutique" and `example.com`.
- **Manifest (`app/manifest.ts`):** `name` and `short_name` set to "Boutique"; screenshot label "Boutique Homepage".
- **PWA / OG image (`app/opengraph-image.tsx`):** Alt text and headline set to "Boutique"; URL set to "example.com".
- **SEOHead:** `SITE_NAME` and `SITE_URL` set to "Boutique" and `example.com`; default description and schema brand references use "Boutique".
- **Sitemap / robots:** Base URL and Sitemap URL use `https://example.com`.

### 1.7 Storefront and admin fallbacks
- **Footer:** Site name fallback "Boutique"; contact phone/momo/address from CMS; Momo line added (icon `ri-wallet-3-line`, "Momo: {contactMomo}").
- **Header, usePageTitle, about/contact/faqs/returns/refund-policy/help/shipping/terms:** Site name fallback "Boutique"; contact fallbacks as above (phone `0241766703`, no email fallback, address "Ghana" where applicable).
- **Contact page:** Contact methods include Phone, Email, WhatsApp, Address; Momo card added when `contact_momo` is set.
- **Admin:** Order detail, pay page, layout, settings — store name fallback "Boutique"; Admin → Settings → Contact Details now includes "Momo (Mobile Money)" field for `contact_momo`.
- **Auth (login/signup):** Logo/link text "Boutique".
- **Product/shop/categories/about/academia layouts:** All metadata titles, descriptions, and OG/Twitter text updated to "Boutique".

### 1.8 Notifications and payments
- **lib/notifications.ts:** `STORE_NAME` fallback "Boutique".
- **app/api/payment/paypal/route.ts:** `brand_name` fallback "Boutique".

---

## 2. New / Refactored Elements (neutral placeholders)

| Item | Before | After |
|------|--------|--------|
| Default site name | Luxury Strand Haven | Boutique |
| Default contact phone | 054 930 7736 | 0241766703 |
| Default contact email | maame890@gmail.com | (empty; set in Admin) |
| Contact Momo | (none) | 0598865781 (setting `contact_momo`) |
| Default address fallback | Kwashieman… / Accra, Ghana | Ghana |
| Base URL | luxury-strand-haven.vercel.app | example.com |
| Twitter handle | @luxurystrandhaven | @store |
| Social sameAs | Branded links | [] |

---

## 3. New setting: `contact_momo`

- **Type:** `SiteSettings.contact_momo` (string).
- **Default:** `'0598865781'` in `context/CMSContext.tsx`.
- **Usage:**
  - **Footer:** Shows "Momo: {contactMomo}" with wallet icon when set.
  - **Contact page:** Adds a "Momo" card with "Momo: {contactMomo}" when set.
  - **Admin → Settings → Contact Details:** New field "Momo (Mobile Money)" (placeholder e.g. 0598865781).
- **Persistence:** Stored in `store_settings` (key `contact_momo`); no DB migration required (key/value table).

---

## 4. Files modified (summary)

- **Context:** `context/CMSContext.tsx` (defaults + `contact_momo`).
- **Components:** `components/Footer.tsx`, `components/Header.tsx`, `components/SEOHead.tsx`.
- **App root:** `app/layout.tsx`, `app/manifest.ts`, `app/opengraph-image.tsx`, `app/sitemap.ts`.
- **Store pages/layouts:** `app/(store)/page.tsx`, `app/(store)/contact/page.tsx`, `app/(store)/contact/layout.tsx`, `app/(store)/shop/layout.tsx`, `app/(store)/categories/layout.tsx`, `app/(store)/about/page.tsx`, `app/(store)/about/layout.tsx`, `app/(store)/academia/page.tsx`, `app/(store)/academia/layout.tsx`, `app/(store)/product/[slug]/page.tsx`, `app/(store)/pay/[orderId]/page.tsx`, `app/(store)/auth/login/page.tsx`, `app/(store)/auth/signup/page.tsx`, `app/(store)/faqs/page.tsx`, `app/(store)/terms/page.tsx`, `app/(store)/returns/page.tsx`, `app/(store)/refund-policy/page.tsx`, `app/(store)/shipping/page.tsx`, `app/(store)/help/article/[id]/page.tsx`.
- **Admin:** `app/admin/layout.tsx`, `app/admin/settings/page.tsx`, `app/admin/orders/[id]/OrderDetailClient.tsx`.
- **API:** `app/api/payment/paypal/route.ts`.
- **Lib / hooks:** `lib/notifications.ts`, `hooks/usePageTitle.ts`.
- **Public:** `public/robots.txt`.

---

## 5. Checklist — no remaining identifiable traces

- [x] No "Luxury Strand Haven", "LSH", "maame890", "pobeenina", "054 930 7736", "Kwashieman", "Been-To", "Davis Street", "MC 1579", "WS-447" in repo (grep verified).
- [x] No branded repository URLs, social URLs, or Vercel domain in defaults (replaced with `example.com` or empty).
- [x] No personal emails or old phone numbers as fallbacks.
- [x] Package.json: no author/repository/homepage/bugs changes required (already neutral "storefront").
- [x] README: generic "E-commerce Storefront"; no ownership claims.
- [x] `.env.local` not modified (user-specific; may contain keys; no branding in code defaults).
- [x] Footer and contact page show Boutique + 0241766703 + Momo: 0598865781 per new details.
- [x] Build: syntax fix applied in `app/layout.tsx` (missing comma after `"sameAs": []`); build re-run to confirm (see below).

---

## 6. Functionality and integrity

- **Preserved:** All business logic, API contracts, type definitions, routing, Supabase usage, build config, dependency versions.
- **Preserved:** CMS-driven settings; new `contact_momo` follows existing pattern (key in `defaultSettings`, used via `getSetting`, editable in Admin).
- **No:** New branding beyond "Boutique" and the provided contact details; no framework or dependency upgrades; no security or schema changes beyond adding one setting key in code/defaults.

---

## 7. Deliverables

1. **Sanitized codebase:** All listed replacements and neutralizations applied.
2. **This summary:** `DEBRAND_AUDIT_SUMMARY.md` (removed/refactored elements, new placeholders, `contact_momo`, file list, checklist).
3. **Confirmation:** No remaining identifiable traces per checklist; functionality preserved; build re-run after JSON fix.

**Next step:** Set `NEXT_PUBLIC_APP_URL` (and optional `NEXT_PUBLIC_SITE_NAME`) in production env; configure contact email and address in Admin → Settings if desired; add real social URLs in Admin or via structured data when ready.

**Build note:** Next.js compiles successfully. Any "Missing Supabase environment variables" during page data collection is an env configuration issue, not from debranding.
