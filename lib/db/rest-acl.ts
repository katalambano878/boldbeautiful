/**
 * Access control for the PostgREST-shaped /rest/v1 shim.
 * Replaces Supabase RLS with an allowlist + JWT role gate.
 */
import { jwtVerify } from "jose";
import { authJwtSecret } from "./mode";

export type RestRole = "anon" | "customer" | "staff" | "admin";

export interface RestActor {
  role: RestRole;
  userId?: string;
}

/** Catalog / CMS — public read */
const PUBLIC_READ = new Set([
  "products",
  "categories",
  "product_images",
  "product_variants",
  "reviews",
  "review_images",
  "store_settings",
  "store_modules",
  "blog_posts",
  "cms_content",
  "navigation_menus",
  "navigation_items",
  "site_settings",
  "coupons",
]);

/** Guest checkout / support — limited inserts */
const ANON_INSERT = new Set([
  "orders",
  "order_items",
  "customers",
  "support_tickets",
  "support_messages",
  "wishlist_items",
  "cart_items",
  "addresses",
]);

/** Authenticated customer may read/write these (ownership not rewritten here — prefer APIs) */
const CUSTOMER_READ = new Set([
  ...PUBLIC_READ,
  "orders",
  "order_items",
  "customers",
  "profiles",
  "addresses",
  "wishlist_items",
  "cart_items",
  "support_tickets",
  "support_messages",
  "notifications",
]);

const CUSTOMER_WRITE = new Set([
  "orders",
  "order_items",
  "customers",
  "profiles",
  "addresses",
  "wishlist_items",
  "cart_items",
  "support_tickets",
  "support_messages",
  "reviews",
]);

/** RPCs callable without admin (server payment routes use in-process admin client) */
const PUBLIC_RPC = new Set([
  "upsert_customer_from_order",
]);

const ADMIN_RPC = new Set([
  "mark_order_paid",
  "update_customer_stats",
  "upsert_customer_from_order",
]);

const ORDER_SAFE_INSERT_KEYS = new Set([
  "order_number",
  "user_id",
  "email",
  "phone",
  "status",
  "payment_status",
  "currency",
  "subtotal",
  "tax_total",
  "shipping_total",
  "discount_total",
  "total",
  "shipping_method",
  "payment_method",
  "payment_provider",
  "notes",
  "shipping_address",
  "billing_address",
  "metadata",
]);

export async function resolveRestActor(req: Request): Promise<RestActor> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { role: "anon" };

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(authJwtSecret()));
    if (payload.typ === "refresh") return { role: "anon" };
    const userId = typeof payload.sub === "string" ? payload.sub : undefined;
    if (!userId) return { role: "anon" };
    const appMeta = (payload.app_metadata || {}) as { role?: string };
    const role = appMeta.role;
    if (role === "admin") return { role: "admin", userId };
    if (role === "staff") return { role: "staff", userId };
    return { role: "customer", userId };
  } catch {
    return { role: "anon" };
  }
}

export function authorizeTable(
  actor: RestActor,
  method: string,
  table: string
): { ok: true } | { ok: false; status: number; message: string } {
  const m = method.toUpperCase();
  const isAdmin = actor.role === "admin" || actor.role === "staff";

  if (isAdmin) return { ok: true };

  if (m === "GET" || m === "HEAD") {
    if (PUBLIC_READ.has(table)) return { ok: true };
    if (actor.role === "customer" && CUSTOMER_READ.has(table)) return { ok: true };
    return { ok: false, status: 401, message: "Authentication required" };
  }

  if (m === "POST") {
    if (ANON_INSERT.has(table)) return { ok: true };
    if (actor.role === "customer" && CUSTOMER_WRITE.has(table)) return { ok: true };
    return { ok: false, status: 403, message: "Insert not allowed" };
  }

  if (m === "PATCH" || m === "PUT") {
    // Guests must not mutate orders/products (blocks payment_status escalation)
    if (actor.role === "customer" && CUSTOMER_WRITE.has(table) && table !== "orders") {
      return { ok: true };
    }
    // Allow customer to update own profile/addresses only — orders locked
    if (actor.role === "customer" && (table === "profiles" || table === "addresses" || table === "customers")) {
      return { ok: true };
    }
    return { ok: false, status: 403, message: "Update not allowed" };
  }

  if (m === "DELETE") {
    if (actor.role === "customer" && (table === "wishlist_items" || table === "cart_items" || table === "addresses")) {
      return { ok: true };
    }
    return { ok: false, status: 403, message: "Delete not allowed" };
  }

  return { ok: false, status: 405, message: "Method not allowed" };
}

export function authorizeRpc(
  actor: RestActor,
  fn: string
): { ok: true } | { ok: false; status: number; message: string } {
  const isAdmin = actor.role === "admin" || actor.role === "staff";
  if (isAdmin && ADMIN_RPC.has(fn)) return { ok: true };
  if (PUBLIC_RPC.has(fn)) return { ok: true };
  return { ok: false, status: 403, message: `RPC "${fn}" is not allowed` };
}

/** Strip privilege-escalation fields from anon/customer writes */
export function sanitizeWritePayload(
  table: string,
  body: unknown,
  actor: RestActor
): unknown {
  const isAdmin = actor.role === "admin" || actor.role === "staff";
  if (isAdmin) return body;

  const scrubRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...row };

    if (table === "profiles") {
      delete out.role;
    }

    if (table === "orders") {
      // Force pending payment — never trust client paid status
      out.payment_status = "pending";
      if (!out.status || out.status === "processing" || out.status === "completed" || out.status === "delivered") {
        out.status = "pending";
      }
      // Drop keys not on allowlist
      for (const key of Object.keys(out)) {
        if (!ORDER_SAFE_INSERT_KEYS.has(key)) delete out[key];
      }
      // POS cash/card path uses admin JWT — customers can't mark paid here
    }

    if (table === "products" || table === "product_variants" || table === "categories") {
      // Non-admin must not write catalog
      return {};
    }

    return out;
  };

  if (Array.isArray(body)) {
    return body.map((r) => (r && typeof r === "object" ? scrubRow(r as Record<string, unknown>) : r));
  }
  if (body && typeof body === "object") {
    return scrubRow(body as Record<string, unknown>);
  }
  return body;
}
