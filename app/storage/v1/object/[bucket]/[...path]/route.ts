import { NextRequest, NextResponse } from "next/server";
import { createStorageClient } from "@/lib/db/storage";
import { isPlainPostgres } from "@/lib/db/mode";
import { resolveRestActor } from "@/lib/db/rest-acl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_BUCKETS = new Set(["products", "categories", "uploads", "blog", "cms"]);

/**
 * Supabase Storage upload:
 *   POST /storage/v1/object/{bucket}/{path}
 *   body = raw file bytes
 * Requires admin/staff JWT (replaces open Supabase storage write).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }

  const actor = await resolveRestActor(req);
  if (actor.role !== "admin" && actor.role !== "staff") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bucket, path } = await ctx.params;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket not allowed" }, { status: 403 });
  }
  const objectPath = path.map(decodeURIComponent).join("/");
  const upsert = (req.headers.get("x-upsert") || "").toLowerCase() === "true";
  const contentType =
    req.headers.get("content-type") || "application/octet-stream";

  const buf = Buffer.from(await req.arrayBuffer());
  const storage = createStorageClient();
  const { data, error } = await storage.from(bucket).upload(objectPath, buf, {
    contentType,
    upsert,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: pub } = storage.from(bucket).getPublicUrl(objectPath);
  return NextResponse.json({
    Key: `${bucket}/${objectPath}`,
    Id: data?.path,
    ...data,
    publicUrl: pub.publicUrl,
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  if (!isPlainPostgres()) {
    return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 503 });
  }
  const actor = await resolveRestActor(req);
  if (actor.role !== "admin" && actor.role !== "staff") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bucket, path } = await ctx.params;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Bucket not allowed" }, { status: 403 });
  }
  const objectPath = path.map(decodeURIComponent).join("/");
  const storage = createStorageClient();
  const { error } = await storage.from(bucket).remove([objectPath]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({});
}
