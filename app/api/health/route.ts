import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Light check: ensure we can query the DB connection (no heavy work)
    await prisma.$queryRaw`SELECT 1 as ok`;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
