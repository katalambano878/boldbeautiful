import { readObject } from "@/lib/db/storage";

export const runtime = "nodejs";
/** Public media files are content-addressed uploads — safe to cache at the edge. */
export const revalidate = 86400;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
): Promise<Response> {
  const { bucket, path } = await ctx.params;
  const objectPath = path.map(decodeURIComponent).join("/");
  const obj = await readObject(bucket, objectPath);
  if (!obj) {
    return new Response(JSON.stringify({ error: "Object not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(new Uint8Array(obj.bytes), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
