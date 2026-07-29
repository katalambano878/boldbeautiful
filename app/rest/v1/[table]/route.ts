import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  applyPostgrestParams,
} from "@/lib/db/supabase-compat";
import { isPlainPostgres } from "@/lib/db/mode";
import {
  authorizeTable,
  resolveRestActor,
  sanitizeWritePayload,
} from "@/lib/db/rest-acl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PG_IDENT = /^[a-z_][a-z0-9_]*$/i;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, prefer, x-client-info, accept-profile, content-profile",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
}

function preferSingle(req: NextRequest): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.includes("application/vnd.pgrst.object+json");
}

function preferReturn(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("return=representation") || prefer.includes("resolution=");
}

function preferCount(req: NextRequest): boolean {
  const prefer = req.headers.get("prefer") || "";
  return prefer.includes("count=exact");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { message, code: "PGRST", details: null, hint: null },
    { status, headers: corsHeaders() }
  );
}

async function gate(req: NextRequest, method: string, table: string) {
  const actor = await resolveRestActor(req);
  const authz = authorizeTable(actor, method, table);
  if (!authz.ok) {
    return { actor, error: jsonError(authz.message, authz.status) };
  }
  return { actor, error: null as null };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const { error: denied } = await gate(req, "GET", table);
  if (denied) return denied;

  const client = createClient();
  const qb = client.from(table);
  const select = req.nextUrl.searchParams.get("select") || "*";
  if (preferCount(req)) {
    qb.select(select, {
      count: "exact",
      head: req.headers.get("prefer")?.includes("head=true"),
    });
  } else {
    qb.select(select);
  }
  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.delete("select");
  applyPostgrestParams(qb as any, params, {
    preferSingle: preferSingle(req),
  });

  const result = await qb;
  if (result.error) {
    return jsonError(result.error.message || "Query failed", 400);
  }

  const headers = new Headers(corsHeaders());
  headers.set("Content-Type", "application/json");
  if (result.count != null) {
    headers.set(
      "Content-Range",
      `0-${Math.max((Array.isArray(result.data) ? result.data.length : 1) - 1, 0)}/${result.count}`
    );
  }

  if (preferSingle(req)) {
    return NextResponse.json(result.data, { status: 200, headers });
  }
  return NextResponse.json(result.data ?? [], { status: 200, headers });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const { actor, error: denied } = await gate(req, "POST", table);
  if (denied) return denied;

  const raw = await req.json().catch(() => null);
  if (raw == null) return jsonError("Invalid JSON body");
  const body = sanitizeWritePayload(table, raw, actor);
  if (
    (Array.isArray(body) && body.some((r) => r && typeof r === "object" && Object.keys(r as object).length === 0)) ||
    (body && typeof body === "object" && !Array.isArray(body) && Object.keys(body as object).length === 0)
  ) {
    return jsonError("Insert payload rejected", 403);
  }

  const client = createClient();
  let qb = client.from(table).insert(body);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Insert failed", 400);

  return NextResponse.json(result.data, {
    status: 201,
    headers: corsHeaders(),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const { actor, error: denied } = await gate(req, "PATCH", table);
  if (denied) return denied;

  const raw = await req.json().catch(() => null);
  if (raw == null || typeof raw !== "object") return jsonError("Invalid JSON body");
  const body = sanitizeWritePayload(table, raw, actor);

  const client = createClient();
  let qb = client.from(table).update(body as Record<string, unknown>);
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  if (preferReturn(req) || preferSingle(req)) {
    qb = qb.select("*") as typeof qb;
  }
  if (preferSingle(req)) qb = qb.single() as typeof qb;

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Update failed", 400);

  return NextResponse.json(result.data, { status: 200, headers: corsHeaders() });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  if (!isPlainPostgres()) {
    return jsonError("Plain Postgres mode is not enabled (DATABASE_URL missing)", 503);
  }
  const { table } = await ctx.params;
  if (!PG_IDENT.test(table)) return jsonError("Invalid table");

  const { error: denied } = await gate(req, "DELETE", table);
  if (denied) return denied;

  const client = createClient();
  let qb = client.from(table).delete();
  applyPostgrestParams(qb as any, req.nextUrl.searchParams);
  if (preferReturn(req)) {
    qb = qb.select("*") as typeof qb;
  }

  const result = await qb;
  if (result.error) return jsonError(result.error.message || "Delete failed", 400);

  return NextResponse.json(result.data ?? null, { status: 200, headers: corsHeaders() });
}
